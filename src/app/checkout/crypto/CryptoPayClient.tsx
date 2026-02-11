"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { encodeURL } from "@solana/pay";
import QRCode from "qrcode";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount as getTokenAccount,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3-compat";
import {
  PublicKey as PublicKeyType,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import BigNumber from "bignumber.js";
import { AlertCircle, ArrowLeftRight, Check, Clock, Info } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  getSuiPayLabel,
  getSuiPayRecipient,
  createSuiPayUri,
  MIST_PER_SUI,
} from "~/lib/sui-pay";
import {
  getSolanaPayLabel,
  CRUST_MINT_MAINNET,
  PUMP_MINT_MAINNET,
  TROLL_MINT_MAINNET,
  USDC_MINT_MAINNET,
  WHITEWHALE_MINT_MAINNET,
  usdcAmountFromUsd,
  tokenAmountFromUsd,
  tokenAmountFromUsdWithPrice,
} from "~/lib/solana-pay";
import { useCurrentUser } from "~/lib/auth-client";
import { Button } from "~/ui/primitives/button";

import { openConnectWalletModal } from "./open-wallet-modal";

import {
  useCryptoOrder,
  type OrderPaymentInfo,
} from "~/hooks/use-crypto-order";
import { useCryptoPrices } from "~/hooks/use-crypto-prices";
import { usePaymentCountdown } from "~/hooks/use-payment-countdown";

const SOL_USD_FALLBACK = 200;

const PAYMENT_LOGO: Record<string, { src: string; alt: string }> = {
  solana: { src: "/crypto/solana/solanaLogoMark.svg", alt: "Solana" },
  usdc: { src: "/crypto/usdc/usdc-logo.svg", alt: "USDC" },
  whitewhale: { src: "/crypto/solana/solanaLogoMark.svg", alt: "WhiteWhale" },
  crust: { src: "/crypto/solana/solanaLogoMark.svg", alt: "CRUST" },
  pump: { src: "/crypto/pump/pump-logomark.svg", alt: "Pump" },
  troll: { src: "/crypto/troll/troll-logomark.png", alt: "TROLL" },
  sui: { src: "/crypto/sui/sui-logo.svg", alt: "Sui" },
};

const PAYMENT_TITLE: Record<string, string> = {
  solana: "Pay with SOL (Solana)",
  usdc: "Pay with USDC (Solana)",
  whitewhale: "Pay with WhiteWhale (Solana)",
  crust: "Pay with CRUST (Solana)",
  pump: "Pay with Pump (Solana)",
  troll: "Pay with TROLL (Solana)",
  sui: "Pay with SUI (Sui Network)",
};

/** Short label for the payment token (for error messages). */
const TOKEN_LABEL: Record<string, string> = {
  solana: "SOL",
  usdc: "USDC",
  whitewhale: "WhiteWhale",
  crust: "CRUST",
  pump: "PUMP",
  troll: "TROLL",
};

const LAMPORTS_PER_SOL = 1e9;
const TX_FEE_BUFFER_LAMPORTS = 10_000;
/** Minimum SOL needed for tx fee (and possible ATA creation) when paying with SPL token */
const MIN_SOL_FOR_TOKEN_TX_LAMPORTS = 50_000;

type PayStatus =
  | "idle"
  | "checking"
  | "insufficient"
  | "sufficient"
  | "sending"
  | "sent"
  | "error";

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}.....${address.slice(-4)}`;
}

// Parse URL hash synchronously (component is ssr:false, window is always available)
function parseSuiHash(): {
  token: "sui";
  suiFromHash: { amountUsd: number; expiresAt: string } | null;
} | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.slice(1);
  if (!raw.toLowerCase().startsWith("sui-")) return null;
  const parts = raw.split("-");
  const amount = Number.parseFloat(parts[1] ?? "0");
  const expiresTs = Number(parts[2] ?? "0");
  if (Number.isFinite(amount) && amount >= 0 && Number.isFinite(expiresTs)) {
    return {
      token: "sui",
      suiFromHash: {
        amountUsd: amount,
        expiresAt: new Date(expiresTs).toISOString(),
      },
    };
  }
  return { token: "sui", suiFromHash: null };
}

export function CryptoPayClient() {
  const { connection } = useConnection();
  const { connected, publicKey, wallet, disconnect, sendTransaction } =
    useWallet();
  const params = useParams();
  const router = useRouter();
  const pathId = (params?.invoiceId as string) ?? "";

  // Parse hash synchronously on first render — no useEffect cascade
  const [suiParsed] = useState(() => parseSuiHash());
  const [token, setToken] = useState<
    "solana" | "usdc" | "whitewhale" | "crust" | "pump" | "troll" | "sui"
  >(() => (suiParsed ? "sui" : "usdc"));
  const [suiFromHash] = useState(() => suiParsed?.suiFromHash ?? null);

  const [copied, setCopied] = useState<"address" | "amount" | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<URL | null>(null);
  const [suiPaymentUri, setSuiPaymentUri] = useState<string | null>(null);
  const [paymentAddress, setPaymentAddress] = useState<string>("");
  const [payStatus, setPayStatus] = useState<PayStatus>("idle");
  const [payError, setPayError] = useState<string | null>(null);
  /** When insufficient: was it SOL for fees or the payment token? */
  const [insufficientReason, setInsufficientReason] = useState<
    "sol_for_fees" | "token" | null
  >(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const { order, loading: orderLoading, error: orderError } = useCryptoOrder({
    orderId: pathId,
    token,
    enabled: true,
    suiFromHash,
  });
  const { solUsdRate, suiUsdRate, crustPriceUsd, pumpPriceUsd } =
    useCryptoPrices();

  // Sync token from order when available so balance check matches selected payment method
  // (e.g. if URL hash is missing or wrong, we still check SOL vs USDC vs SPL correctly)
  const SOLANA_TOKENS = [
    "solana",
    "usdc",
    "whitewhale",
    "crust",
    "pump",
    "troll",
  ] as const;
  useEffect(() => {
    if (!order?.token) return;
    const orderToken = order.token.toLowerCase();
    if (SOLANA_TOKENS.includes(orderToken as (typeof SOLANA_TOKENS)[number])) {
      setToken(orderToken as (typeof SOLANA_TOKENS)[number]);
    }
  }, [order?.token]);

  const amountUsd =
    token === "sui" && suiFromHash
      ? suiFromHash.amountUsd
      : order
        ? order.totalCents / 100
        : 0;
  const expiresAt =
    token === "sui" && suiFromHash
      ? suiFromHash.expiresAt
      : (order?.expiresAt ?? null);

  const { isExpired, formattedTime } = usePaymentCountdown({ expiresAt });

  const rate = solUsdRate ?? SOL_USD_FALLBACK;
  const crustSolPerToken =
    token === "crust" && crustPriceUsd != null && crustPriceUsd > 0 && rate > 0
      ? crustPriceUsd / rate
      : null;
  const pumpSolPerToken =
    token === "pump" && pumpPriceUsd != null && pumpPriceUsd > 0 && rate > 0
      ? pumpPriceUsd / rate
      : null;
  const amountSol = amountUsd > 0 && rate > 0 ? amountUsd / rate : 0;
  const amountSolStr = amountSol.toFixed(6);
  const crustTokenPriceUsd =
    crustSolPerToken != null && crustSolPerToken > 0 && rate > 0
      ? crustSolPerToken * rate
      : 0;
  const pumpTokenPriceUsd =
    pumpSolPerToken != null && pumpSolPerToken > 0 && rate > 0
      ? pumpSolPerToken * rate
      : 0;
  const amountCrust =
    amountUsd > 0 && crustTokenPriceUsd > 0
      ? amountUsd / crustTokenPriceUsd
      : 0;
  const amountCrustStr = amountCrust.toFixed(6);
  const amountPump =
    amountUsd > 0 && pumpTokenPriceUsd > 0
      ? amountUsd / pumpTokenPriceUsd
      : 0;
  const amountPumpStr = amountPump.toFixed(6);
  const amountUsdStr = amountUsd.toFixed(2);
  const amountSui =
    token === "sui" && amountUsd > 0 && (suiUsdRate ?? 0) > 0
      ? amountUsd / (suiUsdRate ?? 1)
      : 0;
  const amountSuiStr = amountSui.toFixed(6);
  const rateLabel =
    token === "crust" && crustTokenPriceUsd > 0
      ? `1 CRUST ≈ ${crustTokenPriceUsd.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 })} USD`
      : token === "pump" && pumpTokenPriceUsd > 0
        ? `1 PUMP ≈ ${pumpTokenPriceUsd.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 })} USD`
        : token === "usdc"
          ? "1 USDC = 1 USD"
          : token === "whitewhale"
            ? "1 WhiteWhale ≈ 1 USD"
            : token === "troll"
              ? "1 TROLL ≈ 1 USD"
            : `1 SOL = ${rate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;

  const { user } = useCurrentUser();
  const email = user?.email ?? order?.email ?? "";
  const paymentMethodLabel =
    token === "usdc"
      ? "USDC (Solana)"
      : token === "whitewhale"
        ? "WhiteWhale"
        : token === "crust"
          ? "Crustafarian (CRUST)"
          : token === "pump"
            ? "Pump (PUMP)"
            : token === "troll"
              ? "Troll (TROLL)"
            : token === "sui"
              ? "Sui (SUI)"
              : "Solana";

  useEffect(() => {
    if (token === "sui") {
      const recipient = getSuiPayRecipient();
      if (!recipient || amountUsd <= 0 || !suiUsdRate) {
        setSuiPaymentUri(null);
        setPaymentAddress(recipient ?? "");
        return;
      }
      const amountMist = BigInt(
        Math.ceil((amountUsd / suiUsdRate) * Number(MIST_PER_SUI)),
      );
      const uri = createSuiPayUri({
        receiverAddress: recipient,
        amountMist,
        nonce: pathId || crypto.randomUUID(),
        label: getSuiPayLabel(),
        message: `Order total: $${amountUsd.toFixed(2)}`,
      });
      setSuiPaymentUri(uri);
      setPaymentAddress(recipient);
      setPaymentUrl(null);
      return;
    }
    setSuiPaymentUri(null);
    const recipient = order?.depositAddress ?? null;
    if (!recipient || amountUsd <= 0) return;
    if (token === "crust") {
      const solPerToken = crustSolPerToken ?? 0;
      const r = solUsdRate ?? SOL_USD_FALLBACK;
      if (solPerToken <= 0 || r <= 0) return;
      const amount = tokenAmountFromUsdWithPrice(amountUsd, solPerToken, r, 6);
      const keypair = Keypair.generate();
      const url = encodeURL({
        recipient: new PublicKey(recipient),
        amount,
        splToken: new PublicKey(CRUST_MINT_MAINNET),
        reference: keypair.publicKey,
        label: getSolanaPayLabel(),
        message: `Order total: $${amountUsd.toFixed(2)}`,
      });
      setPaymentUrl(url);
      setPaymentAddress(recipient);
      return;
    }
    if (token === "pump") {
      const solPerToken = pumpSolPerToken ?? 0;
      const r = solUsdRate ?? SOL_USD_FALLBACK;
      if (solPerToken <= 0 || r <= 0) return;
      const amount = tokenAmountFromUsdWithPrice(amountUsd, solPerToken, r, 6);
      const keypair = Keypair.generate();
      const url = encodeURL({
        recipient: new PublicKey(recipient),
        amount,
        splToken: new PublicKey(PUMP_MINT_MAINNET),
        reference: keypair.publicKey,
        label: getSolanaPayLabel(),
        message: `Order total: $${amountUsd.toFixed(2)}`,
      });
      setPaymentUrl(url);
      setPaymentAddress(recipient);
      return;
    }
    // Native SOL payment (no SPL token)
    if (token === "solana") {
      const r = solUsdRate ?? SOL_USD_FALLBACK;
      if (r <= 0) return;
      const amountSol = new BigNumber(amountUsd).dividedBy(r);
      const keypair = Keypair.generate();
      const url = encodeURL({
        recipient: new PublicKey(recipient),
        amount: amountSol,
        reference: keypair.publicKey,
        label: getSolanaPayLabel(),
        message: `Order total: $${amountUsd.toFixed(2)}`,
      });
      setPaymentUrl(url);
      setPaymentAddress(recipient);
      return;
    }
    // SPL token payments (USDC, WhiteWhale, Troll)
    const keypair = Keypair.generate();
    const reference = keypair.publicKey;
    const isWhiteWhale = token === "whitewhale";
    const isTroll = token === "troll";
    const splTokenMint = isWhiteWhale
      ? WHITEWHALE_MINT_MAINNET
      : isTroll
        ? TROLL_MINT_MAINNET
        : USDC_MINT_MAINNET;
    const amount = isWhiteWhale || isTroll
      ? tokenAmountFromUsd(amountUsd)
      : usdcAmountFromUsd(amountUsd);
    const url = encodeURL({
      recipient: new PublicKey(recipient),
      amount,
      splToken: new PublicKey(splTokenMint),
      reference,
      label: getSolanaPayLabel(),
      message: `Order total: $${amountUsd.toFixed(2)}`,
    });
    setPaymentUrl(url);
    setPaymentAddress(recipient);
  }, [
    amountUsd,
    token,
    crustSolPerToken,
    pumpSolPerToken,
    solUsdRate,
    order?.depositAddress,
    order?.orderId,
  ]);

  const showQrView =
    !isExpired && (token === "sui" ? true : !connected || payStatus === "idle");
  const qrUrlString =
    token === "sui" ? suiPaymentUri : (paymentUrl?.toString() ?? null);
  useEffect(() => {
    if (!qrUrlString) return;
    let cancelled = false;
    QRCode.toDataURL(
      qrUrlString,
      { width: 320, margin: 2, color: { dark: "#000000", light: "#ffffff" } },
      (err, url) => {
        if (cancelled) return;
        if (err) {
          console.error("[QR] Failed to generate QR code:", err);
          return;
        }
        setQrDataUrl(url);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [qrUrlString]);

  useEffect(() => {
    if (!connected) setPayStatus("idle");
  }, [connected]);

  // poll for Solana Pay confirmation when user pays to dynamic deposit address (solana/usdc/crust/whitewhale)
  const solanaPayPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (token === "sui" || !order?.depositAddress || amountUsd <= 0 || isExpired)
      return;
    const isNativeSol = token === "solana";
    const splTokenMint = isNativeSol
      ? "native"
      : token === "crust"
        ? CRUST_MINT_MAINNET
        : token === "pump"
          ? PUMP_MINT_MAINNET
          : token === "whitewhale"
            ? WHITEWHALE_MINT_MAINNET
            : token === "troll"
              ? TROLL_MINT_MAINNET
              : USDC_MINT_MAINNET;
    const amountStr = isNativeSol
      ? String(
          Math.ceil(amountSol * LAMPORTS_PER_SOL) + TX_FEE_BUFFER_LAMPORTS,
        )
      : token === "crust" &&
          crustSolPerToken != null &&
          crustSolPerToken > 0 &&
          rate > 0
        ? tokenAmountFromUsdWithPrice(
            amountUsd,
            crustSolPerToken,
            rate,
            6,
          ).toString()
        : token === "pump" &&
            pumpSolPerToken != null &&
            pumpSolPerToken > 0 &&
            rate > 0
          ? tokenAmountFromUsdWithPrice(
              amountUsd,
              pumpSolPerToken,
              rate,
              6,
            ).toString()
          : token === "whitewhale" || token === "troll"
            ? tokenAmountFromUsd(amountUsd).toString()
            : usdcAmountFromUsd(amountUsd).toString();
    const params = new URLSearchParams({
      depositAddress: order.depositAddress,
      amount: amountStr,
      splToken: splTokenMint,
    });
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/payments/solana-pay/status?${params.toString()}`,
        );
        const data = (await res.json()) as {
          status: string;
          signature?: string;
        };
        if (data.status === "confirmed") {
          if (solanaPayPollRef.current) {
            clearInterval(solanaPayPollRef.current);
            solanaPayPollRef.current = null;
          }
          try {
            await fetch("/api/checkout/solana-pay/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                depositAddress: order.depositAddress,
                orderId: order.orderId,
                signature: data.signature,
                amount: amountStr,
                splToken: splTokenMint,
                ...(publicKey ? { payerWalletAddress: publicKey.toBase58() } : {}),
              }),
            });
          } catch {
            // order stays pending; can be reconciled later
          }
          router.push(
            `/checkout/success?orderId=${encodeURIComponent(order.orderId)}`,
          );
        }
      } catch {
        // keep polling
      }
    }, 1500);
    solanaPayPollRef.current = interval;
    return () => {
      if (solanaPayPollRef.current) {
        clearInterval(solanaPayPollRef.current);
        solanaPayPollRef.current = null;
      }
    };
  }, [
    token,
    order?.depositAddress,
    order?.orderId,
    amountUsd,
    amountSol,
    isExpired,
    crustSolPerToken,
    pumpSolPerToken,
    rate,
    router,
    publicKey,
  ]);

  const copyAddress = useCallback(() => {
    if (paymentAddress) {
      void navigator.clipboard.writeText(paymentAddress);
      setCopied("address");
      setTimeout(() => setCopied(null), 2000);
    }
  }, [paymentAddress]);

  const amountDisplayStr =
    token === "crust"
      ? amountCrustStr
      : token === "pump"
        ? amountPumpStr
        : token === "usdc" || token === "whitewhale" || token === "troll"
          ? amountUsdStr
          : amountSolStr;
  const amountUnit =
    token === "crust"
      ? "CRUST"
      : token === "pump"
        ? "PUMP"
        : token === "usdc"
          ? "USDC"
          : token === "whitewhale"
            ? "WhiteWhale"
            : token === "troll"
              ? "TROLL"
              : "SOL";

  const copyAmount = useCallback(() => {
    void navigator.clipboard.writeText(`${amountDisplayStr} ${amountUnit}`);
    setCopied("amount");
    setTimeout(() => setCopied(null), 2000);
  }, [amountDisplayStr, amountUnit]);

  const requiredLamports =
    Math.ceil(amountSol * LAMPORTS_PER_SOL) + TX_FEE_BUFFER_LAMPORTS;

  // Build and send Solana transaction manually (avoids @solana/pay's recipient existence check)
  // Fresh deposit addresses won't have account info until first transaction, so we skip that validation
  const handlePayWithWallet = useCallback(async () => {
    if (!publicKey || !connection || !sendTransaction || !order?.depositAddress)
      return;
    setPayError(null);
    setPayStatus("sending");
    try {
      const recipient = new PublicKey(order.depositAddress);
      const transaction = new Transaction();

      if (token === "solana") {
        // Native SOL transfer - no recipient account check needed
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipient,
            lamports: requiredLamports,
          }),
        );
      } else {
        // SPL token transfer (USDC, CRUST, WhiteWhale)
        // Supports both standard Token Program and Token-2022 Program
        let splTokenMint: PublicKeyType;
        let amountBigNumber: BigNumber;

        if (token === "crust") {
          if (
            crustSolPerToken == null ||
            crustSolPerToken <= 0 ||
            rate <= 0
          ) {
            setPayError("CRUST price unavailable. Please try again.");
            setPayStatus("error");
            return;
          }
          amountBigNumber = tokenAmountFromUsdWithPrice(
            amountUsd,
            crustSolPerToken,
            rate,
            6,
          );
          splTokenMint = new PublicKey(CRUST_MINT_MAINNET);
        } else if (token === "pump") {
          if (
            pumpSolPerToken == null ||
            pumpSolPerToken <= 0 ||
            rate <= 0
          ) {
            setPayError("Pump price unavailable. Please try again.");
            setPayStatus("error");
            return;
          }
          amountBigNumber = tokenAmountFromUsdWithPrice(
            amountUsd,
            pumpSolPerToken,
            rate,
            6,
          );
          splTokenMint = new PublicKey(PUMP_MINT_MAINNET);
        } else if (token === "usdc") {
          amountBigNumber = usdcAmountFromUsd(amountUsd);
          splTokenMint = new PublicKey(USDC_MINT_MAINNET);
        } else if (token === "troll") {
          amountBigNumber = tokenAmountFromUsd(amountUsd);
          splTokenMint = new PublicKey(TROLL_MINT_MAINNET);
        } else {
          // whitewhale
          amountBigNumber = tokenAmountFromUsd(amountUsd);
          splTokenMint = new PublicKey(WHITEWHALE_MINT_MAINNET);
        }

        // Try to get mint info from both Token Program and Token-2022 Program
        let mint;
        let tokenProgramId = TOKEN_PROGRAM_ID;
        
        try {
          mint = await getMint(connection, splTokenMint, undefined, TOKEN_PROGRAM_ID);
        } catch {
          // Try Token-2022 Program if standard Token Program fails
          try {
            mint = await getMint(connection, splTokenMint, undefined, TOKEN_2022_PROGRAM_ID);
            tokenProgramId = TOKEN_2022_PROGRAM_ID;
          } catch {
            setPayError("Could not find token mint. Please try again.");
            setPayStatus("error");
            return;
          }
        }

        // Get sender's Associated Token Account (ATA) using the detected program
        const senderATA = getAssociatedTokenAddressSync(
          splTokenMint,
          publicKey,
          false,
          tokenProgramId,
        );

        // Get recipient's ATA - may not exist yet for fresh deposit addresses
        const recipientATA = getAssociatedTokenAddressSync(
          splTokenMint,
          recipient,
          true, // allowOwnerOffCurve for PDA/fresh addresses
          tokenProgramId,
        );

        // Check if recipient ATA exists; if not, create it
        const recipientATAInfo = await connection.getAccountInfo(recipientATA);
        if (!recipientATAInfo) {
          // Add instruction to create the recipient's ATA (payer = sender)
          transaction.add(
            createAssociatedTokenAccountInstruction(
              publicKey, // payer
              recipientATA, // ATA to create
              recipient, // owner of the ATA
              splTokenMint, // token mint
              tokenProgramId,
            ),
          );
        }

        // Convert BigNumber amount to token units
        const tokenAmount = amountBigNumber
          .times(new BigNumber(10).pow(mint.decimals))
          .integerValue(BigNumber.ROUND_FLOOR);
        const tokens = BigInt(tokenAmount.toString());

        // Add transfer instruction using the detected program
        transaction.add(
          createTransferCheckedInstruction(
            senderATA,
            splTokenMint,
            recipientATA,
            publicKey,
            tokens,
            mint.decimals,
            [],
            tokenProgramId,
          ),
        );
      }

      // Set transaction metadata
      transaction.feePayer = publicKey;
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;

      // Send the transaction
      await sendTransaction(transaction, connection, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      setPayStatus("sent");
      // Existing polling will detect the transfer at the deposit address
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      
      // User rejected/cancelled the transaction in their wallet - not a real error
      const isUserRejected =
        /user rejected|user denied|cancelled|canceled|rejected the request/i.test(msg) ||
        (err as { code?: number }).code === 4001; // Standard wallet rejection code
      
      if (isUserRejected) {
        // Show a friendly "try again" state, not an error
        setPayError("Transaction cancelled. Click below to try again.");
        setPayStatus("error");
        return;
      }
      
      const isInsufficient =
        /insufficient|not enough|balance too low/i.test(msg) ||
        (err as { code?: number }).code === 1;
      setPayError(
        isInsufficient
          ? "Insufficient funds in your wallet. Please add SOL or the payment token and try again."
          : msg || "Transaction failed. Please try again.",
      );
      setPayStatus("error");
    }
  }, [
    connection,
    publicKey,
    sendTransaction,
    order?.depositAddress,
    token,
    amountUsd,
    crustSolPerToken,
    pumpSolPerToken,
    rate,
    requiredLamports,
  ]);

  /** Check if wallet has sufficient balance before sending. Used to show "insufficient" flow instead of prompting to sign. */
  const checkBalanceSufficient = useCallback(
    async (): Promise<{ sufficient: boolean; reason?: "sol_for_fees" | "token" }> => {
      if (!publicKey || !connection)
        return { sufficient: false, reason: "token" };
      try {
        const solBalance = await connection.getBalance(publicKey);
        if (token === "solana") {
          return {
            sufficient: solBalance >= requiredLamports,
            reason:
              solBalance >= requiredLamports ? undefined : "token",
          };
        }
        // SPL token: need enough SOL for fees first, then enough token balance
        if (solBalance < MIN_SOL_FOR_TOKEN_TX_LAMPORTS)
          return { sufficient: false, reason: "sol_for_fees" };
      let splTokenMint: PublicKeyType;
      // amountBaseUnits: the amount already in smallest token units (e.g. 1 USDC = 1_000_000)
      // These helper functions (usdcAmountFromUsd, tokenAmountFromUsd, tokenAmountFromUsdWithPrice)
      // already multiply by 10^decimals, so we must NOT scale again.
      let amountBaseUnits: BigNumber;
      if (token === "crust") {
        if (crustSolPerToken == null || crustSolPerToken <= 0 || rate <= 0)
          return { sufficient: false, reason: "token" };
        amountBaseUnits = tokenAmountFromUsdWithPrice(
          amountUsd,
          crustSolPerToken,
          rate,
          6,
        );
        splTokenMint = new PublicKey(CRUST_MINT_MAINNET);
      } else if (token === "pump") {
        if (pumpSolPerToken == null || pumpSolPerToken <= 0 || rate <= 0)
          return { sufficient: false, reason: "token" };
        amountBaseUnits = tokenAmountFromUsdWithPrice(
          amountUsd,
          pumpSolPerToken,
          rate,
          6,
        );
        splTokenMint = new PublicKey(PUMP_MINT_MAINNET);
      } else if (token === "usdc") {
        amountBaseUnits = usdcAmountFromUsd(amountUsd);
        splTokenMint = new PublicKey(USDC_MINT_MAINNET);
      } else if (token === "whitewhale") {
        amountBaseUnits = tokenAmountFromUsd(amountUsd);
        splTokenMint = new PublicKey(WHITEWHALE_MINT_MAINNET);
      } else if (token === "troll") {
        amountBaseUnits = tokenAmountFromUsd(amountUsd);
        splTokenMint = new PublicKey(TROLL_MINT_MAINNET);
      } else {
        return { sufficient: false, reason: "token" };
      }
      let tokenProgramId = TOKEN_PROGRAM_ID;
      try {
        await getMint(connection, splTokenMint, undefined, TOKEN_PROGRAM_ID);
      } catch {
        try {
          await getMint(connection, splTokenMint, undefined, TOKEN_2022_PROGRAM_ID);
          tokenProgramId = TOKEN_2022_PROGRAM_ID;
        } catch {
          return { sufficient: false, reason: "token" };
        }
      }
      const senderATA = getAssociatedTokenAddressSync(
        splTokenMint,
        publicKey,
        false,
        tokenProgramId,
      );
      let balance: bigint;
      try {
        const account = await getTokenAccount(
          connection,
          senderATA,
          "confirmed",
          tokenProgramId,
        );
        balance = account.amount;
      } catch {
        // No ATA or RPC error: treat as 0 balance
        balance = 0n;
      }
      // amountBaseUnits is already in smallest token units — do NOT multiply by 10^decimals again
      const requiredTokens = amountBaseUnits.integerValue(BigNumber.ROUND_CEIL);
      const tokenSufficient =
        BigInt(requiredTokens.toString()) <= balance;
      return {
        sufficient: tokenSufficient,
        reason: tokenSufficient ? undefined : "token",
      };
    } catch {
      return { sufficient: false, reason: "token" };
    }
  }, [
    connection,
    publicKey,
    token,
    amountUsd,
    crustSolPerToken,
    pumpSolPerToken,
    rate,
    requiredLamports,
  ]);

  /** User clicked "Pay with your wallet": check balance first, then send or show insufficient flow */
  const handlePayWithWalletClick = useCallback(async () => {
    if (!publicKey || !connection || !sendTransaction || !order?.depositAddress)
      return;
    setPayError(null);
    setPayStatus("checking");
    setInsufficientReason(null);
    const result = await checkBalanceSufficient();
    if (!result.sufficient) {
      setInsufficientReason(result.reason ?? "token");
      setPayStatus("insufficient");
      return;
    }
    await handlePayWithWallet();
  }, [
    publicKey,
    connection,
    sendTransaction,
    order?.depositAddress,
    checkBalanceSufficient,
    handlePayWithWallet,
  ]);

  const handlePayManually = useCallback(() => {
    setPayStatus("idle");
    setInsufficientReason(null);
  }, []);

  const handleRecreateOrder = useCallback(() => {
    router.push("/checkout");
  }, [router]);

  const logo = PAYMENT_LOGO[token] ?? PAYMENT_LOGO.solana;
  const title = PAYMENT_TITLE[token] ?? PAYMENT_TITLE.solana;

  if (!pathId?.trim()) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Missing order. Start checkout from your cart.
          </p>
          <Link
            href="/checkout"
            className="text-primary underline hover:underline"
          >
            Back to checkout
          </Link>
        </div>
      </div>
    );
  }

  if (orderLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading order…</p>
      </div>
    );
  }

  const isSuiFlow = token === "sui";
  if (isSuiFlow ? !suiFromHash : orderError || !order) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {isSuiFlow
              ? (orderError ?? "Invalid Sui link")
              : (orderError ?? "Order not found")}
          </p>
          <Link
            href="/checkout"
            className="text-primary underline hover:underline"
          >
            Back to checkout
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-5">
        <div className="flex min-w-0 flex-col gap-6 min-[560px]:flex-row min-[560px]:items-start">
          {/* Left: payment box */}
          <div className="min-w-0 flex-1 rounded-xl border border-border bg-card p-6 min-[560px]:min-w-[560px]">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Image
                  alt={logo.alt}
                  className="h-8 w-10 shrink-0 object-contain"
                  height={32}
                  src={logo.src}
                  width={40}
                />
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  {title}
                </h1>
              </div>

              {token === "sui" && !getSuiPayRecipient() ? (
                <div className="flex flex-col gap-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Sui Payment Kit is not configured. Set
                    NEXT_PUBLIC_SUI_PAY_RECIPIENT in .env.
                  </p>
                  <Link
                    href="/checkout"
                    className="text-primary underline hover:underline"
                  >
                    Back to checkout
                  </Link>
                </div>
              ) : isExpired ? (
                <div className="flex flex-col gap-6">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <Clock
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <h2 className="text-lg font-semibold">
                        Payment not received in time
                      </h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Unfortunately we did not receive a payment in the time
                      window assigned. Please recreate this order and
                      you&apos;ll get a new address and a price quote.
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <Button
                      variant="secondary"
                      size="lg"
                      type="button"
                      onClick={handleRecreateOrder}
                    >
                      Recreate order
                    </Button>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
                    <Info
                      className="size-5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <div>
                      <p className="font-semibold">
                        If you did already send a payment
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Please keep this screen open, once we detect it on the
                        network we will show you your options.
                      </p>
                    </div>
                  </div>
                </div>
              ) : !connected || payStatus === "idle" ? (
                <>
                  <div className="flex justify-center">
                    {token === "crust" && crustSolPerToken === null ? (
                      <div className="flex min-h-[320px] min-w-[320px] items-center justify-center rounded-lg border border-border bg-muted p-8 text-center text-sm text-muted-foreground">
                        Loading CRUST price from pump.fun…
                      </div>
                    ) : token === "pump" && pumpSolPerToken === null ? (
                      <div className="flex min-h-[320px] min-w-[320px] items-center justify-center rounded-lg border border-border bg-muted p-8 text-center text-sm text-muted-foreground">
                        Loading Pump price from pump.fun…
                      </div>
                    ) : token === "crust" && crustSolPerToken === 0 ? (
                      <div className="flex min-h-[320px] min-w-[320px] flex-col items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-8 text-center text-sm text-destructive">
                        <AlertCircle className="size-10 shrink-0" aria-hidden />
                        <p className="font-medium">CRUST price unavailable</p>
                        <p className="text-muted-foreground">
                          We couldn&apos;t load the CRUST price. Check your
                          connection and refresh.
                        </p>
                      </div>
                    ) : token === "pump" && pumpSolPerToken === 0 ? (
                      <div className="flex min-h-[320px] min-w-[320px] flex-col items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-8 text-center text-sm text-destructive">
                        <AlertCircle className="size-10 shrink-0" aria-hidden />
                        <p className="font-medium">Pump price unavailable</p>
                        <p className="text-muted-foreground">
                          We couldn&apos;t load the Pump price. Check your
                          connection and refresh.
                        </p>
                      </div>
                    ) : qrDataUrl ? (
                      <div className="relative inline-block">
                        <img
                          src={qrDataUrl}
                          alt="Payment QR code"
                          width={320}
                          height={320}
                          className="rounded-lg"
                        />
                        {/* Logo overlay in the center of the QR code */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="rounded-full bg-white p-1.5 shadow-sm">
                            <img
                              src={logo.src}
                              alt=""
                              width={36}
                              height={36}
                              className="size-9 object-contain"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="flex min-h-[320px] min-w-[320px] items-center justify-center rounded-lg bg-white p-2"
                        aria-hidden
                      >
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                          <span className="text-sm">Loading QR code…</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <h2 className="mb-4 text-base font-semibold">
                      Payment details
                    </h2>
                    <div className="space-y-4">
                      <div className="text-sm">
                        <p className="mb-1 text-muted-foreground">
                          Payment unique address
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="break-all rounded bg-background px-2 py-1 font-mono text-xs">
                            {paymentAddress || "—"}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0 gap-1.5"
                            onClick={copyAddress}
                            disabled={!paymentAddress}
                          >
                            {copied === "address" ? (
                              <Check className="size-4 text-green-600" />
                            ) : (
                              <CopyIcon />
                            )}
                            Copy
                          </Button>
                        </div>
                      </div>
                      <div className="text-sm">
                        <p className="mb-1 text-muted-foreground">
                          Amount to pay
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {amountDisplayStr} {amountUnit}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0 gap-1.5"
                            onClick={copyAmount}
                            disabled={
                              (token === "crust" && crustSolPerToken == null) ||
                              (token === "pump" && pumpSolPerToken == null)
                            }
                          >
                            {copied === "amount" ? (
                              <Check className="size-4 text-green-600" />
                            ) : (
                              <CopyIcon />
                            )}
                            Copy
                          </Button>
                        </div>
                      </div>
                      <div className="text-base">
                        <p className="mb-1 text-muted-foreground">Expires in</p>
                        <p className="font-mono font-medium tabular-nums">
                          {formattedTime}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-6 rounded-lg border border-border bg-muted/30 p-6">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {wallet?.adapter.icon && (
                        <img
                          src={wallet.adapter.icon}
                          alt=""
                          className="size-8 rounded object-contain"
                          width={32}
                          height={32}
                        />
                      )}
                      <span className="font-mono text-sm">
                        {publicKey
                          ? truncateAddress(publicKey.toBase58())
                          : "—"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="cursor-pointer text-sm text-destructive hover:underline"
                      onClick={() => disconnect()}
                    >
                      Disconnect
                    </button>
                  </div>
                  {payStatus === "checking" && (
                    <p className="text-sm text-muted-foreground">
                      Checking balance…
                    </p>
                  )}
                  {payStatus === "sending" && (
                    <p className="text-sm text-muted-foreground">
                      Opening your wallet to confirm…
                    </p>
                  )}
                  {payStatus === "sent" && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 p-4">
                        <Check className="size-5 shrink-0 text-green-600 dark:text-green-500" />
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                          Transaction sent. Waiting for confirmation…
                        </p>
                      </div>
                      <p className="text-center text-sm text-muted-foreground">
                        You can close this after your wallet confirms. We will
                        detect the payment automatically.
                      </p>
                    </div>
                  )}
                  {payStatus === "error" && (
                    <div className="flex flex-col gap-6">
                      <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4">
                        <AlertCircle className="size-5 shrink-0 text-destructive" />
                        <p className="text-sm font-medium text-destructive">
                          {payError ?? "Transaction failed. Please try again."}
                        </p>
                      </div>
                      <Button
                        className="w-full gap-2"
                        size="lg"
                        type="button"
                        onClick={handlePayWithWalletClick}
                      >
                        {wallet?.adapter.icon && (
                          <img
                            src={wallet.adapter.icon}
                            alt=""
                            className="size-5 object-contain"
                            width={20}
                            height={20}
                          />
                        )}
                        Try again with {wallet?.adapter.name ?? "wallet"}
                      </Button>
                      <div className="flex items-center gap-3">
                        <span className="h-px flex-1 bg-border" />
                        <span className="text-sm font-medium text-muted-foreground">
                          or
                        </span>
                        <span className="h-px flex-1 bg-border" />
                      </div>
                      <div className="flex justify-center">
                        <Button
                          variant="secondary"
                          className="w-1/2 min-w-0"
                          size="lg"
                          type="button"
                          onClick={handlePayManually}
                        >
                          Pay manually
                        </Button>
                      </div>
                    </div>
                  )}
                  {payStatus === "insufficient" && (
                    <div className="flex flex-col gap-6">
                      <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
                        <AlertCircle className="size-5 shrink-0 text-amber-600 dark:text-amber-500" />
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                          {insufficientReason === "sol_for_fees"
                            ? `You have enough ${TOKEN_LABEL[token] ?? "funds"} for this order, but you need a small amount of SOL in your wallet for network fees (e.g. ~0.00005 SOL). Add a little SOL and try again, or pay manually below.`
                            : `You don't have enough ${TOKEN_LABEL[token] ?? "funds"} in your wallet for this order${token !== "solana" ? " (you also need a small amount of SOL for network fees)" : ""}. Add funds or pay manually below.`}
                        </p>
                      </div>
                      <Button
                        className="w-full gap-2"
                        size="lg"
                        type="button"
                        onClick={handlePayWithWalletClick}
                      >
                        {wallet?.adapter.icon && (
                          <img
                            src={wallet.adapter.icon}
                            alt=""
                            className="size-5 object-contain"
                            width={20}
                            height={20}
                          />
                        )}
                        Try again with {wallet?.adapter.name ?? "wallet"}
                      </Button>
                      <div className="flex justify-center">
                        <Button
                          variant="secondary"
                          className="w-1/2 min-w-0"
                          size="lg"
                          type="button"
                          onClick={handlePayManually}
                        >
                          Pay manually
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!isExpired && token === "sui" && suiPaymentUri && (
                <div className="flex justify-center">
                  <Button className="min-w-[12rem]" size="lg" asChild>
                    <a
                      href={suiPaymentUri}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Open in wallet
                    </a>
                  </Button>
                </div>
              )}
              {!isExpired &&
                token !== "sui" &&
                (!connected || payStatus === "idle") && (
                  <div className="flex justify-center">
                    {!connected ? (
                      <Button
                        className="min-w-[12rem]"
                        size="lg"
                        onClick={openConnectWalletModal}
                      >
                        Connect wallet
                      </Button>
                    ) : (
                      <Button
                        className="min-w-[12rem]"
                        size="lg"
                        variant="secondary"
                        type="button"
                        onClick={handlePayWithWalletClick}
                      >
                        Pay with your wallet
                      </Button>
                    )}
                  </div>
                )}
            </div>
          </div>

          {/* Right: Order details box */}
          <div className="min-w-0 shrink-0 min-[560px]:w-[510px] min-[560px]:sticky min-[560px]:top-8 min-[560px]:self-start">
            <div className="rounded-xl border border-border bg-card px-6 py-5">
              <h2 className="mb-4 text-xl font-semibold">Order details</h2>
              <dl className="space-y-3 text-base">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Email address</dt>
                  <dd className="flex items-center gap-2">
                    <span>{email || "—"}</span>
                    {!user?.email && (
                      <button
                        type="button"
                        onClick={() => router.push("/checkout")}
                        className="text-primary underline hover:underline"
                      >
                        Change
                      </button>
                    )}
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Payment method</dt>
                  <dd className="flex items-center gap-2">
                    <span>{paymentMethodLabel}</span>
                    <button
                      type="button"
                      onClick={() => router.push("/checkout")}
                      className="text-primary underline hover:underline"
                    >
                      Change
                    </button>
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Order ID</dt>
                  <dd>
                    <code className="break-all font-mono text-xs">
                      {pathId || "—"}
                    </code>
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <dt className="text-muted-foreground">Fiat value</dt>
                  <dd className="font-medium">
                    USD {amountUsd > 0 ? amountUsd.toFixed(2) : "0.00"}
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-lg">
                  <dt className="font-medium">Total</dt>
                  <dd className="font-semibold">
                    {token === "sui"
                      ? `${amountSuiStr} SUI`
                      : token === "crust"
                        ? `${amountCrustStr} CRUST`
                        : token === "pump"
                          ? `${amountPumpStr} PUMP`
                          : token === "usdc"
                            ? `${amountUsdStr} USDC`
                            : token === "whitewhale"
                              ? `${amountUsdStr} WhiteWhale`
                              : token === "troll"
                                ? `${amountUsdStr} TROLL`
                                : `${amountSolStr} SOL`}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowLeftRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                {token === "sui"
                  ? `We've converted this price from USD to SUI at our rate of approximately ${rateLabel}. Uses the Sui Payment Kit (sui:pay).`
                  : token === "crust"
                    ? `We've converted this price from USD to CRUST at our rate of approximately ${rateLabel}.`
                    : token === "pump"
                      ? `We've converted this price from USD to PUMP at our rate of approximately ${rateLabel}.`
                      : token === "usdc"
                        ? `Pay in USDC (Solana). ${rateLabel}.`
                        : token === "whitewhale"
                          ? `Pay in WhiteWhale. ${rateLabel}.`
                          : token === "troll"
                            ? `Pay in TROLL. ${rateLabel}.`
                            : `We've converted this price from USD to SOL at our rate of approximately ${rateLabel}.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.369.022.739.15 1.027.331l.962.562c.1.06.153.166.153.278 0 .16-.13.29-.29.29h-.962a.704.704 0 01-.332-.027 6.57 6.57 0 01-1.027-.331m-7.332 0A2.251 2.251 0 0112 2.25h3a2.25 2.25 0 012.166 1.638m-7.332 0c.369.022.739.15 1.027.331l.962.562c.1.06.153.166.153.278 0 .16-.13.29-.29.29h-.962a.704.704 0 01-.332-.027 6.57 6.57 0 01-1.027-.331M7.5 4.5v12.75a2.25 2.25 0 002.25 2.25h6.75a2.25 2.25 0 002.25-2.25V4.5m-9 0h9"
      />
    </svg>
  );
}
