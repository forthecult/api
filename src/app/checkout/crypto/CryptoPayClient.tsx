"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { createQR, encodeURL } from "@solana/pay";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
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
  USDC_MINT_MAINNET,
  WHITEWHALE_MINT_MAINNET,
  usdcAmountFromUsd,
  tokenAmountFromUsd,
  tokenAmountFromUsdWithPrice,
} from "~/lib/solana-pay";
import { useCurrentUser } from "~/lib/auth-client";
import { Button } from "~/ui/primitives/button";

import { openConnectWalletModal } from "./open-wallet-modal";

const EXPIRY_MINUTES = 60;
const SOL_USD_FALLBACK = 200;

const PAYMENT_LOGO: Record<string, { src: string; alt: string }> = {
  solana: { src: "/crypto/solana/solanaLogoMark.svg", alt: "Solana" },
  usdc: { src: "/crypto/usdc/usdc-logo.svg", alt: "USDC" },
  whitewhale: { src: "/crypto/solana/solanaLogoMark.svg", alt: "WhiteWhale" },
  crust: { src: "/crypto/solana/solanaLogoMark.svg", alt: "CRUST" },
  sui: { src: "/crypto/sui/sui-logo.svg", alt: "Sui" },
};

const PAYMENT_TITLE: Record<string, string> = {
  solana: "Pay with Solana",
  usdc: "Pay with USDC",
  whitewhale: "Pay with WhiteWhale",
  crust: "Pay with Crustafarian (CRUST)",
  sui: "Pay with Sui",
};

function getInitialTimeLeft(expiresAt: string | null): number {
  if (!expiresAt) return EXPIRY_MINUTES * 60;
  const ts = expiresAt.includes("T")
    ? Date.parse(expiresAt)
    : Number(expiresAt);
  if (!Number.isFinite(ts)) return EXPIRY_MINUTES * 60;
  return Math.max(0, Math.floor((ts - Date.now()) / 1000));
}

const LAMPORTS_PER_SOL = 1e9;
const TX_FEE_BUFFER_LAMPORTS = 10_000;

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

type OrderPaymentInfo = {
  orderId: string;
  depositAddress: string;
  totalCents: number;
  email?: string;
  expiresAt: string;
};

export function CryptoPayClient() {
  const { connection } = useConnection();
  const { connected, publicKey, wallet, disconnect, sendTransaction } =
    useWallet();
  const params = useParams();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const pathId = (params?.invoiceId as string) ?? "";
  const [token, setToken] = useState<
    "solana" | "usdc" | "whitewhale" | "crust" | "sui"
  >("usdc");
  const [order, setOrder] = useState<OrderPaymentInfo | null>(null);
  const [orderLoading, setOrderLoading] = useState(true);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [suiFromHash, setSuiFromHash] = useState<{
    amountUsd: number;
    expiresAt: string;
  } | null>(null);
  const [hashParsed, setHashParsed] = useState(false);

  const [copied, setCopied] = useState<"address" | "amount" | null>(null);
  const [timeLeft, setTimeLeft] = useState(EXPIRY_MINUTES * 60);
  const [solUsdRate, setSolUsdRate] = useState<number | null>(null);
  const [suiUsdRate, setSuiUsdRate] = useState<number | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<URL | null>(null);
  const [suiPaymentUri, setSuiPaymentUri] = useState<string | null>(null);
  const [paymentAddress, setPaymentAddress] = useState<string>("");
  const [payStatus, setPayStatus] = useState<PayStatus>("idle");
  const [payError, setPayError] = useState<string | null>(null);
  const [crustPriceUsd, setCrustPriceUsd] = useState<number | null>(null);
  const qrContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const raw = window.location.hash.slice(1);
    const hash = raw.toLowerCase();
    if (hash.startsWith("sui-")) {
      const parts = raw.split("-");
      const amount = Number.parseFloat(parts[1] ?? "0");
      const expiresTs = Number(parts[2] ?? "0");
      setToken("sui");
      if (
        Number.isFinite(amount) &&
        amount >= 0 &&
        Number.isFinite(expiresTs)
      ) {
        setSuiFromHash({
          amountUsd: amount,
          expiresAt: new Date(expiresTs).toISOString(),
        });
      } else {
        setSuiFromHash(null);
      }
    } else if (
      hash === "solana" ||
      hash === "usdc" ||
      hash === "whitewhale" ||
      hash === "crust" ||
      hash === "sui"
    ) {
      setToken(hash);
      if (hash !== "sui") setSuiFromHash(null);
    }
    setHashParsed(true);
  }, [mounted]);

  useEffect(() => {
    if (!hashParsed) return;
    if (token === "sui") {
      setOrderLoading(false);
      setOrderError(
        suiFromHash
          ? null
          : "Invalid Sui link: missing amount or expiry in URL hash.",
      );
      if (suiFromHash) setTimeLeft(getInitialTimeLeft(suiFromHash.expiresAt));
      return;
    }
    if (!pathId?.trim() || !mounted) {
      setOrderLoading(false);
      setOrderError(!pathId?.trim() ? "Missing order" : null);
      return;
    }
    let cancelled = false;
    setOrderLoading(true);
    setOrderError(null);
    fetch(`/api/checkout/orders/${encodeURIComponent(pathId)}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error("Order not found");
          throw new Error("Failed to load order");
        }
        return res.json();
      })
      .then((data: OrderPaymentInfo) => {
        if (!cancelled) {
          setOrder(data);
          setTimeLeft(getInitialTimeLeft(data.expiresAt));
        }
      })
      .catch((err) => {
        if (!cancelled)
          setOrderError(
            err instanceof Error ? err.message : "Failed to load order",
          );
      })
      .finally(() => {
        if (!cancelled) setOrderLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, pathId, mounted, hashParsed, suiFromHash]);

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

  const rate = solUsdRate ?? SOL_USD_FALLBACK;
  const crustSolPerToken =
    token === "crust" && crustPriceUsd != null && crustPriceUsd > 0 && rate > 0
      ? crustPriceUsd / rate
      : null;
  const amountSol = amountUsd > 0 && rate > 0 ? amountUsd / rate : 0;
  const amountSolStr = amountSol.toFixed(6);
  const crustTokenPriceUsd =
    crustSolPerToken != null && crustSolPerToken > 0 && rate > 0
      ? crustSolPerToken * rate
      : 0;
  const amountCrust =
    amountUsd > 0 && crustTokenPriceUsd > 0
      ? amountUsd / crustTokenPriceUsd
      : 0;
  const amountCrustStr = amountCrust.toFixed(6);
  const amountUsdStr = amountUsd.toFixed(2);
  const amountSui =
    token === "sui" && amountUsd > 0 && (suiUsdRate ?? 0) > 0
      ? amountUsd / (suiUsdRate ?? 1)
      : 0;
  const amountSuiStr = amountSui.toFixed(6);
  const rateLabel =
    token === "crust" && crustTokenPriceUsd > 0
      ? `1 CRUST ≈ ${crustTokenPriceUsd.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 })} USD`
      : token === "usdc"
        ? "1 USDC = 1 USD"
        : token === "whitewhale"
          ? "1 WhiteWhale ≈ 1 USD"
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
          : token === "sui"
            ? "Sui (SUI)"
            : "Solana";

  // Use cached /api/crypto/prices for all crypto prices (single request, server caches 60s)
  useEffect(() => {
    fetch("/api/crypto/prices")
      .then((res) => res.json())
      .then((data: { SOL?: number; CRUST?: number }) => {
        if (typeof data?.SOL === "number" && data.SOL > 0)
          setSolUsdRate(data.SOL);
        if (typeof data?.CRUST === "number" && data.CRUST > 0)
          setCrustPriceUsd(data.CRUST);
      })
      .catch(() => {
        setSolUsdRate(SOL_USD_FALLBACK);
        setCrustPriceUsd(null);
      });
  }, []);

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
    const keypair = Keypair.generate();
    const reference = keypair.publicKey;
    const isWhiteWhale = token === "whitewhale";
    const splTokenMint = isWhiteWhale
      ? WHITEWHALE_MINT_MAINNET
      : USDC_MINT_MAINNET;
    const amount = isWhiteWhale
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
    solUsdRate,
    order?.depositAddress,
    order?.orderId,
  ]);

  const expired = timeLeft === 0;
  const showQrView =
    !expired && (token === "sui" ? true : !connected || payStatus === "idle");
  const qrUrlString =
    token === "sui" ? suiPaymentUri : (paymentUrl?.toString() ?? null);
  useEffect(() => {
    if (!qrUrlString || !showQrView) return;
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled || !qrContainerRef.current) return;
      // Clear previous QR code using DOM methods (safer than innerHTML)
      while (qrContainerRef.current.firstChild) {
        qrContainerRef.current.removeChild(qrContainerRef.current.firstChild);
      }
      const qr = createQR(qrUrlString, 320, "white", "black");
      qr.append(qrContainerRef.current);
    }, 100);
    return () => {
      cancelled = true;
      clearTimeout(t);
      // Clear QR code on cleanup using DOM methods
      if (qrContainerRef.current) {
        while (qrContainerRef.current.firstChild) {
          qrContainerRef.current.removeChild(qrContainerRef.current.firstChild);
        }
      }
    };
  }, [qrUrlString, showQrView]);

  useEffect(() => {
    if (!connected) setPayStatus("idle");
  }, [connected]);

  // poll for Solana Pay confirmation when user pays to dynamic deposit address (solana/usdc/crust/whitewhale)
  const solanaPayPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (token === "sui" || !order?.depositAddress || amountUsd <= 0 || expired)
      return;
    const splTokenMint =
      token === "crust"
        ? CRUST_MINT_MAINNET
        : token === "whitewhale"
          ? WHITEWHALE_MINT_MAINNET
          : USDC_MINT_MAINNET;
    const amountStr =
      token === "crust" &&
      crustSolPerToken != null &&
      crustSolPerToken > 0 &&
      rate > 0
        ? tokenAmountFromUsdWithPrice(
            amountUsd,
            crustSolPerToken,
            rate,
            6,
          ).toString()
        : token === "whitewhale"
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
    expired,
    crustSolPerToken,
    rate,
    router,
  ]);

  useEffect(() => {
    setTimeLeft(getInitialTimeLeft(expiresAt));
  }, [expiresAt]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (expiresAt) {
        const ts = expiresAt.includes("T")
          ? Date.parse(expiresAt)
          : Number(expiresAt);
        if (Number.isFinite(ts)) {
          const remaining = Math.max(0, Math.floor((ts - Date.now()) / 1000));
          setTimeLeft(remaining);
          return;
        }
      }
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

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
      : token === "usdc" || token === "whitewhale"
        ? amountUsdStr
        : amountSolStr;
  const amountUnit =
    token === "crust"
      ? "CRUST"
      : token === "usdc"
        ? "USDC"
        : token === "whitewhale"
          ? "WhiteWhale"
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
        } else if (token === "usdc") {
          amountBigNumber = usdcAmountFromUsd(amountUsd);
          splTokenMint = new PublicKey(USDC_MINT_MAINNET);
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
    rate,
    requiredLamports,
  ]);

  const handlePayManually = useCallback(() => {
    setPayStatus("idle");
  }, []);

  const handleRecreateOrder = useCallback(() => {
    router.push("/checkout");
  }, [router]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const expiryDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  const logo = PAYMENT_LOGO[token] ?? PAYMENT_LOGO.solana;
  const title = PAYMENT_TITLE[token] ?? PAYMENT_TITLE.solana;

  if (!mounted) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

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
              ) : expired ? (
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
                    ) : token === "crust" && crustSolPerToken === 0 ? (
                      <div className="flex min-h-[320px] min-w-[320px] flex-col items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-8 text-center text-sm text-destructive">
                        <AlertCircle className="size-10 shrink-0" aria-hidden />
                        <p className="font-medium">CRUST price unavailable</p>
                        <p className="text-muted-foreground">
                          We couldn&apos;t load the CRUST price. Check your
                          connection and refresh.
                        </p>
                      </div>
                    ) : (
                      <div
                        ref={qrContainerRef}
                        className="min-h-[320px] min-w-[320px] bg-muted"
                        aria-hidden
                      />
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
                              token === "crust" && crustSolPerToken == null
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
                          {expiryDisplay}
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
                        onClick={handlePayWithWallet}
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
                          You currently don&apos;t have enough funds in your
                          wallet! Please add funds before continuing!
                        </p>
                      </div>
                      <Button
                        className="w-full gap-2"
                        size="lg"
                        type="button"
                        onClick={handlePayWithWallet}
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

              {!expired && token === "sui" && suiPaymentUri && (
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
              {!expired &&
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
                        onClick={handlePayWithWallet}
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
                        : token === "usdc"
                          ? `${amountUsdStr} USDC`
                          : token === "whitewhale"
                            ? `${amountUsdStr} WhiteWhale`
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
                    : token === "usdc"
                      ? `Pay in USDC (Solana). ${rateLabel}.`
                      : token === "whitewhale"
                        ? `Pay in WhiteWhale. ${rateLabel}.`
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
