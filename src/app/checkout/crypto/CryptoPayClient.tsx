"use client";

import { encodeURL, type Amount } from "@solana/pay";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
  getAccount as getTokenAccount,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { useSolanaConnection, useSolanaWallet } from "~/app/checkout/crypto/solana-wallet-stub";
import { Keypair, PublicKey } from "@solana/web3-compat";
import {
  type Connection as ConnectionType,
  PublicKey as PublicKeyFromWeb3,
  type PublicKey as PublicKeyType,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import BigNumber from "bignumber.js";
import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  Clock,
  Info,
  QrCode,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";

import type { InitialOrderLike } from "~/hooks/use-crypto-order";
import {
  type OrderPaymentInfo,
  useCryptoOrder,
} from "~/hooks/use-crypto-order";
import { useCryptoPrices } from "~/hooks/use-crypto-prices";
import { usePaymentCountdown } from "~/hooks/use-payment-countdown";
import { listUserAccounts, useCurrentUser } from "~/lib/auth-client";
import { useIsMobile } from "~/lib/hooks/use-mobile";
import {
  CRUST_MINT_MAINNET,
  CULT_MINT_MAINNET,
  getSolanaPayLabel,
  PUMP_MINT_MAINNET,
  SKR_MINT_MAINNET,
  SOLUNA_MINT_MAINNET,
  tokenAmountFromUsd,
  tokenAmountFromUsdWithPrice,
  TROLL_MINT_MAINNET,
  USDC_MINT_MAINNET,
  usdcAmountFromUsd,
  WHITEWHALE_MINT_MAINNET,
} from "~/lib/solana-pay";
import {
  createSuiPayUri,
  getSuiPayLabel,
  getSuiPayRecipient,
  MIST_PER_SUI,
} from "~/lib/sui-pay";
import { Button } from "~/ui/primitives/button";
import { Dialog, DialogContent, DialogTitle } from "~/ui/primitives/dialog";

import { openConnectWalletModal } from "./open-wallet-modal";

const SOL_USD_FALLBACK = 200;

const PAYMENT_LOGO: Record<string, { alt: string; src: string }> = {
  crust: { alt: "CRUST", src: "/crypto/crustafarianism/crust-logo.png" },
  cult: { alt: "CULT", src: "/crypto/cult/cult-logo.svg" },
  pump: { alt: "Pump", src: "/crypto/pump/pump-logomark.svg" },
  seeker: {
    alt: "Seeker (SKR)",
    src: "/crypto/seeker/S_Token_Circle_White.svg",
  },
  solana: { alt: "Solana", src: "/crypto/solana/solanaLogoMark.svg" },
  soluna: { alt: "SOLUNA", src: "/crypto/soluna/soluna-logo.png" },
  sui: { alt: "Sui", src: "/crypto/sui/sui-logo.svg" },
  troll: { alt: "TROLL", src: "/crypto/troll/troll-logomark.png" },
  usdc: { alt: "USDC", src: "/crypto/usdc/usdc-logo.svg" },
  whitewhale: { alt: "WhiteWhale", src: "/crypto/solana/solanaLogoMark.svg" },
};

const PAYMENT_TITLE: Record<string, string> = {
  crust: "Pay with CRUST (Solana)",
  cult: "Pay with CULT (Solana)",
  pump: "Pay with Pump (Solana)",
  seeker: "Pay with Seeker (SKR) (Solana)",
  solana: "Pay with SOL (Solana)",
  soluna: "Pay with SOLUNA (Solana)",
  sui: "Pay with SUI (Sui Network)",
  troll: "Pay with TROLL (Solana)",
  usdc: "Pay with USDC (Solana)",
  whitewhale: "Pay with WhiteWhale (Solana)",
};

/** Short label for the payment token (for error messages and display). */
const TOKEN_LABEL: Record<string, string> = {
  crust: "CRUST",
  cult: "CULT",
  pump: "PUMP",
  seeker: "SKR",
  solana: "SOL (Solana network)",
  soluna: "SOLUNA",
  troll: "TROLL",
  usdc: "USDC",
  whitewhale: "WhiteWhale",
};

const LAMPORTS_PER_SOL = 1e9;
const TX_FEE_BUFFER_LAMPORTS = 10_000;
/** Minimum SOL needed for tx fee (and possible ATA creation) when paying with SPL token */
const MIN_SOL_FOR_TOKEN_TX_LAMPORTS = 50_000;

type PayStatus =
  | "checking"
  | "error"
  | "idle"
  | "insufficient"
  | "sending"
  | "sent"
  | "sufficient";

export function CryptoPayClient({
  initialOrder,
}: { initialOrder?: InitialOrderLike } = {}) {
  const { connection: connectionRaw } = useSolanaConnection();
  const connection = connectionRaw as ConnectionType | undefined;
  const {
    connect,
    connected,
    connecting,
    disconnect,
    publicKey,
    select,
    sendTransaction,
    wallet,
    wallets,
  } = useSolanaWallet();
  const params = useParams();
  const router = useRouter();
  const pathId = (params?.invoiceId as string) ?? "";

  // Parse hash synchronously on first render — no useEffect cascade
  const [suiParsed] = useState(() => parseSuiHash());
  const [token, setToken] = useState<
    | "crust"
    | "cult"
    | "pump"
    | "seeker"
    | "solana"
    | "soluna"
    | "sui"
    | "troll"
    | "usdc"
    | "whitewhale"
  >(() => (suiParsed ? "sui" : "usdc"));
  const [suiFromHash] = useState(() => suiParsed?.suiFromHash ?? null);

  const [copied, setCopied] = useState<"address" | "amount" | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<null | URL>(null);
  const [suiPaymentUri, setSuiPaymentUri] = useState<null | string>(null);
  const [paymentAddress, setPaymentAddress] = useState<string>("");
  const [payStatus, setPayStatus] = useState<PayStatus>("idle");
  const [payError, setPayError] = useState<null | string>(null);
  /** When insufficient: was it SOL for fees or the payment token? */
  const [insufficientReason, setInsufficientReason] = useState<
    "sol_for_fees" | "token" | null
  >(null);
  const [qrDataUrl, setQrDataUrl] = useState<null | string>(null);
  const [showQrDialog, setShowQrDialog] = useState(false);
  /** User's Solana account from auth (when signed in with wallet). Used to auto-connect on pay page. */
  const [userSolanaAccountId, setUserSolanaAccountId] = useState<
    null | string
  >(null);
  const autoConnectAttemptedRef = useRef(false);
  const isMobile = useIsMobile();

  const { user } = useCurrentUser();

  // Resolve current user's Solana account so we can auto-connect when paying with Solana
  useEffect(() => {
    if (!user?.id) {
      setUserSolanaAccountId(null);
      return;
    }
    let cancelled = false;
    listUserAccounts()
      .then((res) => {
        if (cancelled || res.error) return;
        const solana = (res.data ?? []).find(
          (a: { providerId?: string }) => a.providerId === "solana",
        ) as { accountId: string } | undefined;
        if (!cancelled && solana?.accountId)
          setUserSolanaAccountId(solana.accountId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // When user is signed in with Solana and we're on Solana pay, try to connect wallet once (same account they auth'd with)
  useEffect(() => {
    if (
      !userSolanaAccountId ||
      token === "sui" ||
      connected ||
      connecting ||
      !wallets?.length ||
      autoConnectAttemptedRef.current
    )
      return;
    autoConnectAttemptedRef.current = true;
    const first = wallets[0];
    if (first) {
      select(first.adapter.name);
      connect();
    }
  }, [
    userSolanaAccountId,
    token,
    connected,
    connecting,
    wallets,
    select,
    connect,
  ]);

  const {
    error: orderError,
    loading: orderLoading,
    order,
  } = useCryptoOrder({
    enabled: true,
    initialOrder: initialOrder as InitialOrderLike | undefined,
    orderId: pathId,
    suiFromHash,
    token,
  });
  const {
    crustPriceUsd,
    cultPriceUsd,
    pumpPriceUsd,
    seekerPriceUsd,
    solunaPriceUsd,
    solUsdRate,
    suiUsdRate,
  } = useCryptoPrices();

  // Sync token from order when available so balance check matches selected payment method
  // (e.g. if URL hash is missing or wrong, we still check SOL vs USDC vs SPL correctly)
  const SOLANA_TOKENS = [
    "solana",
    "usdc",
    "whitewhale",
    "crust",
    "cult",
    "pump",
    "troll",
    "soluna",
    "seeker",
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

  const { formattedTime, isExpired } = usePaymentCountdown({ expiresAt });

  const rate = solUsdRate ?? SOL_USD_FALLBACK;
  const crustSolPerToken =
    token === "crust" && crustPriceUsd != null && crustPriceUsd > 0 && rate > 0
      ? crustPriceUsd / rate
      : null;
  const pumpSolPerToken =
    token === "pump" && pumpPriceUsd != null && pumpPriceUsd > 0 && rate > 0
      ? pumpPriceUsd / rate
      : null;
  const solunaSolPerToken =
    token === "soluna" &&
    solunaPriceUsd != null &&
    solunaPriceUsd > 0 &&
    rate > 0
      ? solunaPriceUsd / rate
      : null;
  const seekerSolPerToken =
    token === "seeker" &&
    seekerPriceUsd != null &&
    seekerPriceUsd > 0 &&
    rate > 0
      ? seekerPriceUsd / rate
      : null;
  const cultSolPerToken =
    token === "cult" && cultPriceUsd != null && cultPriceUsd > 0 && rate > 0
      ? cultPriceUsd / rate
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
  const solunaTokenPriceUsd =
    solunaSolPerToken != null && solunaSolPerToken > 0 && rate > 0
      ? solunaSolPerToken * rate
      : 0;
  const seekerTokenPriceUsd =
    seekerSolPerToken != null && seekerSolPerToken > 0 && rate > 0
      ? seekerSolPerToken * rate
      : 0;
  const cultTokenPriceUsd =
    cultSolPerToken != null && cultSolPerToken > 0 && rate > 0
      ? cultSolPerToken * rate
      : 0;
  const amountCrust =
    amountUsd > 0 && crustTokenPriceUsd > 0
      ? amountUsd / crustTokenPriceUsd
      : 0;
  const amountCrustStr = amountCrust.toFixed(6);
  const amountPump =
    amountUsd > 0 && pumpTokenPriceUsd > 0 ? amountUsd / pumpTokenPriceUsd : 0;
  const amountPumpStr = amountPump.toFixed(6);
  const amountSoluna =
    amountUsd > 0 && solunaTokenPriceUsd > 0
      ? amountUsd / solunaTokenPriceUsd
      : 0;
  const amountSolunaStr = amountSoluna.toFixed(6);
  const amountSeeker =
    amountUsd > 0 && seekerTokenPriceUsd > 0
      ? amountUsd / seekerTokenPriceUsd
      : 0;
  const amountSeekerStr = amountSeeker.toFixed(6);
  const amountCult =
    amountUsd > 0 && cultTokenPriceUsd > 0
      ? amountUsd / cultTokenPriceUsd
      : 0;
  const amountCultStr = amountCult.toFixed(6);
  const amountUsdStr = amountUsd.toFixed(2);
  const amountSui =
    token === "sui" && amountUsd > 0 && (suiUsdRate ?? 0) > 0
      ? amountUsd / (suiUsdRate ?? 1)
      : 0;
  const amountSuiStr = amountSui.toFixed(6);
  const rateLabel =
    token === "crust" && crustTokenPriceUsd > 0
      ? `1 CRUST ≈ ${crustTokenPriceUsd.toLocaleString("en-US", { maximumFractionDigits: 6, minimumFractionDigits: 4 })} USD`
      : token === "pump" && pumpTokenPriceUsd > 0
        ? `1 PUMP ≈ ${pumpTokenPriceUsd.toLocaleString("en-US", { maximumFractionDigits: 6, minimumFractionDigits: 4 })} USD`
        : token === "soluna" && solunaTokenPriceUsd > 0
          ? `1 SOLUNA ≈ ${solunaTokenPriceUsd.toLocaleString("en-US", { maximumFractionDigits: 6, minimumFractionDigits: 4 })} USD`
          : token === "seeker" && seekerTokenPriceUsd > 0
            ? `1 SKR ≈ ${seekerTokenPriceUsd.toLocaleString("en-US", { maximumFractionDigits: 6, minimumFractionDigits: 4 })} USD`
            : token === "cult" && cultTokenPriceUsd > 0
              ? `1 CULT ≈ ${cultTokenPriceUsd.toLocaleString("en-US", { maximumFractionDigits: 6, minimumFractionDigits: 4 })} USD`
              : token === "usdc"
              ? "1 USDC = 1 USD"
              : token === "whitewhale"
                ? "1 WhiteWhale ≈ 1 USD"
                : token === "troll"
                  ? "1 TROLL ≈ 1 USD"
                  : `1 SOL = ${rate.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} USD`;

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
                : token === "soluna"
                ? "SOLUNA (SOLUNA)"
                : token === "seeker"
                  ? "Seeker (SKR)"
                  : token === "cult"
                    ? "Culture (CULT)"
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
        amountMist,
        label: getSuiPayLabel(),
        message: `Order total: $${amountUsd.toFixed(2)}`,
        nonce: pathId || crypto.randomUUID(),
        receiverAddress: recipient,
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
      // encodeURL expects amount in token units (human-readable), not base units
      const amount = new BigNumber(amountUsd).div(
        new BigNumber(solPerToken).times(r),
      );
      const keypair = Keypair.generate();
      const url = encodeURL({
        amount: amount as unknown as Amount,
        label: getSolanaPayLabel(),
        message: `Order total: $${amountUsd.toFixed(2)}`,
        recipient: new PublicKey(recipient),
        reference: keypair.publicKey,
        splToken: new PublicKey(CRUST_MINT_MAINNET),
      });
      setPaymentUrl(url);
      setPaymentAddress(recipient);
      return;
    }
    if (token === "pump") {
      const solPerToken = pumpSolPerToken ?? 0;
      const r = solUsdRate ?? SOL_USD_FALLBACK;
      if (solPerToken <= 0 || r <= 0) return;
      // encodeURL expects amount in token units (human-readable), not base units
      const amount = new BigNumber(amountUsd).div(
        new BigNumber(solPerToken).times(r),
      );
      const keypair = Keypair.generate();
      const url = encodeURL({
        amount: amount as unknown as Amount,
        label: getSolanaPayLabel(),
        message: `Order total: $${amountUsd.toFixed(2)}`,
        recipient: new PublicKey(recipient),
        reference: keypair.publicKey,
        splToken: new PublicKey(PUMP_MINT_MAINNET),
      });
      setPaymentUrl(url);
      setPaymentAddress(recipient);
      return;
    }
    if (token === "soluna") {
      const solPerToken = solunaSolPerToken ?? 0;
      const r = solUsdRate ?? SOL_USD_FALLBACK;
      if (solPerToken <= 0 || r <= 0) return;
      const amount = new BigNumber(amountUsd).div(
        new BigNumber(solPerToken).times(r),
      );
      const keypair = Keypair.generate();
      const url = encodeURL({
        amount: amount as unknown as Amount,
        label: getSolanaPayLabel(),
        message: `Order total: $${amountUsd.toFixed(2)}`,
        recipient: new PublicKey(recipient),
        reference: keypair.publicKey,
        splToken: new PublicKey(SOLUNA_MINT_MAINNET),
      });
      setPaymentUrl(url);
      setPaymentAddress(recipient);
      return;
    }
    if (token === "seeker") {
      const solPerToken = seekerSolPerToken ?? 0;
      const r = solUsdRate ?? SOL_USD_FALLBACK;
      if (solPerToken <= 0 || r <= 0) return;
      const amount = new BigNumber(amountUsd).div(
        new BigNumber(solPerToken).times(r),
      );
      const keypair = Keypair.generate();
      const url = encodeURL({
        amount: amount as unknown as Amount,
        label: getSolanaPayLabel(),
        message: `Order total: $${amountUsd.toFixed(2)}`,
        recipient: new PublicKey(recipient),
        reference: keypair.publicKey,
        splToken: new PublicKey(SKR_MINT_MAINNET),
      });
      setPaymentUrl(url);
      setPaymentAddress(recipient);
      return;
    }
    if (token === "cult") {
      const solPerToken = cultSolPerToken ?? 0;
      const r = solUsdRate ?? SOL_USD_FALLBACK;
      if (solPerToken <= 0 || r <= 0) return;
      const amount = new BigNumber(amountUsd).div(
        new BigNumber(solPerToken).times(r),
      );
      const keypair = Keypair.generate();
      const url = encodeURL({
        amount: amount as unknown as Amount,
        label: getSolanaPayLabel(),
        message: `Order total: $${amountUsd.toFixed(2)}`,
        recipient: new PublicKey(recipient),
        reference: keypair.publicKey,
        splToken: new PublicKey(CULT_MINT_MAINNET),
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
        amount: amountSol as unknown as Amount,
        label: getSolanaPayLabel(),
        message: `Order total: $${amountUsd.toFixed(2)}`,
        recipient: new PublicKey(recipient),
        reference: keypair.publicKey,
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
    // encodeURL expects amount in token units (human-readable), not base units
    const amount = new BigNumber(amountUsd);
    const url = encodeURL({
      amount: amount as unknown as Amount,
      label: getSolanaPayLabel(),
      message: `Order total: $${amountUsd.toFixed(2)}`,
      recipient: new PublicKey(recipient),
      reference,
      splToken: new PublicKey(splTokenMint),
    });
    setPaymentUrl(url);
    setPaymentAddress(recipient);
  }, [
    amountUsd,
    token,
    crustSolPerToken,
    pumpSolPerToken,
    solunaSolPerToken,
    seekerSolPerToken,
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
      { color: { dark: "#000000", light: "#ffffff" }, margin: 2, width: 320 },
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
  const solanaPayPollRef = useRef<null | ReturnType<typeof setInterval>>(null);
  useEffect(() => {
    if (
      token === "sui" ||
      !order?.depositAddress ||
      amountUsd <= 0 ||
      isExpired
    )
      return;
    const isNativeSol = token === "solana";
    const splTokenMint = isNativeSol
      ? "native"
      : token === "crust"
        ? CRUST_MINT_MAINNET
        : token === "pump"
          ? PUMP_MINT_MAINNET
          : token === "soluna"
            ? SOLUNA_MINT_MAINNET
            : token === "seeker"
              ? SKR_MINT_MAINNET
              : token === "cult"
                ? CULT_MINT_MAINNET
                : token === "whitewhale"
                  ? WHITEWHALE_MINT_MAINNET
                  : token === "troll"
                    ? TROLL_MINT_MAINNET
                    : USDC_MINT_MAINNET;
    // For native SOL, amount is in lamports (server uses raw lamport comparison).
    // For SPL tokens, amount must be in human-readable token units (e.g. "1" for 1 USDC),
    // because @solana/pay's validateTransfer multiplies by 10^decimals internally.
    const amountStr = isNativeSol
      ? String(Math.ceil(amountSol * LAMPORTS_PER_SOL) + TX_FEE_BUFFER_LAMPORTS)
      : token === "crust" &&
          crustSolPerToken != null &&
          crustSolPerToken > 0 &&
          rate > 0
        ? tokenAmountFromUsdWithPrice(amountUsd, crustSolPerToken, rate, 6)
            .div(1e6)
            .toString()
        : token === "pump" &&
            pumpSolPerToken != null &&
            pumpSolPerToken > 0 &&
            rate > 0
          ? tokenAmountFromUsdWithPrice(amountUsd, pumpSolPerToken, rate, 6)
              .div(1e6)
              .toString()
          : token === "soluna" &&
              solunaSolPerToken != null &&
              solunaSolPerToken > 0 &&
              rate > 0
            ? tokenAmountFromUsdWithPrice(amountUsd, solunaSolPerToken, rate, 6)
                .div(1e6)
                .toString()
            : token === "seeker" &&
                seekerSolPerToken != null &&
                seekerSolPerToken > 0 &&
                rate > 0
              ? tokenAmountFromUsdWithPrice(
                  amountUsd,
                  seekerSolPerToken,
                  rate,
                  6,
                )
                  .div(1e6)
                  .toString()
              : token === "cult" &&
                  cultSolPerToken != null &&
                  cultSolPerToken > 0 &&
                  rate > 0
                ? tokenAmountFromUsdWithPrice(
                    amountUsd,
                    cultSolPerToken,
                    rate,
                    6,
                  )
                    .div(1e6)
                    .toString()
                : String(amountUsd);
    const params = new URLSearchParams({
      amount: amountStr,
      depositAddress: order.depositAddress,
      splToken: splTokenMint,
    });
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/payments/solana-pay/status?${params.toString()}`,
        );
        const data = (await res.json()) as {
          signature?: string;
          status: string;
        };
        if (data.status === "confirmed") {
          if (solanaPayPollRef.current) {
            clearInterval(solanaPayPollRef.current);
            solanaPayPollRef.current = null;
          }
          try {
            await fetch("/api/checkout/solana-pay/confirm", {
              body: JSON.stringify({
                amount: amountStr,
                depositAddress: order.depositAddress,
                orderId: order.orderId,
                signature: data.signature,
                splToken: splTokenMint,
                ...(publicKey
                  ? { payerWalletAddress: publicKey.toBase58() }
                  : {}),
              }),
              headers: { "Content-Type": "application/json" },
              method: "POST",
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
    solunaSolPerToken,
    seekerSolPerToken,
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
        : token === "soluna"
          ? amountSolunaStr
          : token === "seeker"
            ? amountSeekerStr
            : token === "cult"
              ? amountCultStr
              : token === "usdc" || token === "whitewhale" || token === "troll"
              ? amountUsdStr
              : amountSolStr;
  const amountUnit =
    token === "crust"
      ? "CRUST"
      : token === "pump"
        ? "PUMP"
        : token === "soluna"
          ? "SOLUNA"
          : token === "seeker"
            ? "SKR"
            : token === "cult"
              ? "CULT"
              : token === "usdc"
                ? "USDC"
                : token === "whitewhale"
                  ? "WhiteWhale"
                  : token === "troll"
                    ? "TROLL"
                    : token === "solana"
                      ? "SOL (Solana network)"
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
    const conn = connection as ConnectionType;
    const pubkey = new PublicKeyFromWeb3(publicKey.toBase58());
    setPayError(null);
    setPayStatus("sending");
    try {
      const recipient = new PublicKeyFromWeb3(order.depositAddress);
      const transaction = new Transaction();

      if (token === "solana") {
        // Native SOL transfer - no recipient account check needed
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: pubkey,
            lamports: requiredLamports,
            toPubkey: recipient,
          }),
        );
      } else {
        // SPL token transfer (USDC, CRUST, WhiteWhale)
        // Supports both standard Token Program and Token-2022 Program
        let splTokenMint: PublicKeyType;
        let amountBigNumber: BigNumber;

        if (token === "crust") {
          if (crustSolPerToken == null || crustSolPerToken <= 0 || rate <= 0) {
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
          splTokenMint = new PublicKeyFromWeb3(CRUST_MINT_MAINNET);
        } else if (token === "pump") {
          if (pumpSolPerToken == null || pumpSolPerToken <= 0 || rate <= 0) {
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
          splTokenMint = new PublicKeyFromWeb3(PUMP_MINT_MAINNET);
        } else if (token === "soluna") {
          if (
            solunaSolPerToken == null ||
            solunaSolPerToken <= 0 ||
            rate <= 0
          ) {
            setPayError("SOLUNA price unavailable. Please try again.");
            setPayStatus("error");
            return;
          }
          amountBigNumber = tokenAmountFromUsdWithPrice(
            amountUsd,
            solunaSolPerToken,
            rate,
            6,
          );
          splTokenMint = new PublicKeyFromWeb3(SOLUNA_MINT_MAINNET);
        } else if (token === "seeker") {
          if (
            seekerSolPerToken == null ||
            seekerSolPerToken <= 0 ||
            rate <= 0
          ) {
            setPayError("Seeker (SKR) price unavailable. Please try again.");
            setPayStatus("error");
            return;
          }
          amountBigNumber = tokenAmountFromUsdWithPrice(
            amountUsd,
            seekerSolPerToken,
            rate,
            6,
          );
          splTokenMint = new PublicKeyFromWeb3(SKR_MINT_MAINNET);
        } else if (token === "cult") {
          if (
            cultSolPerToken == null ||
            cultSolPerToken <= 0 ||
            rate <= 0
          ) {
            setPayError("CULT price unavailable. Please try again.");
            setPayStatus("error");
            return;
          }
          amountBigNumber = tokenAmountFromUsdWithPrice(
            amountUsd,
            cultSolPerToken,
            rate,
            6,
          );
          splTokenMint = new PublicKeyFromWeb3(CULT_MINT_MAINNET);
        } else if (token === "usdc") {
          amountBigNumber = usdcAmountFromUsd(amountUsd);
          splTokenMint = new PublicKeyFromWeb3(USDC_MINT_MAINNET);
        } else if (token === "troll") {
          amountBigNumber = tokenAmountFromUsd(amountUsd);
          splTokenMint = new PublicKeyFromWeb3(TROLL_MINT_MAINNET);
        } else {
          // whitewhale
          amountBigNumber = tokenAmountFromUsd(amountUsd);
          splTokenMint = new PublicKeyFromWeb3(WHITEWHALE_MINT_MAINNET);
        }

        // Try to get mint info from both Token Program and Token-2022 Program
        let mint;
        let tokenProgramId = TOKEN_PROGRAM_ID;

        try {
          mint = await getMint(
            conn,
            splTokenMint,
            undefined,
            TOKEN_PROGRAM_ID,
          );
        } catch {
          // Try Token-2022 Program if standard Token Program fails
          try {
            mint = await getMint(
              conn,
              splTokenMint,
              undefined,
              TOKEN_2022_PROGRAM_ID,
            );
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
          pubkey,
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
        const recipientATAInfo = await conn.getAccountInfo(recipientATA);
        if (!recipientATAInfo) {
          // Add instruction to create the recipient's ATA (payer = sender)
          transaction.add(
            createAssociatedTokenAccountInstruction(
              pubkey, // payer
              recipientATA, // ATA to create
              recipient, // owner of the ATA
              splTokenMint, // token mint
              tokenProgramId,
            ),
          );
        }

        // amountBigNumber is already in base units (helpers use hardcoded 6 decimals).
        // If the actual mint decimals differ, recalculate to use the correct decimals.
        let tokens: bigint;
        const assumedDecimals = 6;
        if (mint.decimals !== assumedDecimals) {
          // Convert back to token units then re-scale with actual decimals
          const tokenUnits = amountBigNumber.div(
            new BigNumber(10).pow(assumedDecimals),
          );
          tokens = BigInt(
            tokenUnits
              .times(new BigNumber(10).pow(mint.decimals))
              .integerValue(BigNumber.ROUND_FLOOR)
              .toString(),
          );
        } else {
          tokens = BigInt(
            amountBigNumber.integerValue(BigNumber.ROUND_FLOOR).toString(),
          );
        }

        // Add transfer instruction using the detected program
        transaction.add(
          createTransferCheckedInstruction(
            senderATA,
            splTokenMint,
            recipientATA,
            pubkey,
            tokens,
            mint.decimals,
            [],
            tokenProgramId,
          ),
        );
      }

      // Set transaction metadata
      transaction.feePayer = pubkey;
      const { blockhash } = await conn.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;

      // Send the transaction
      await sendTransaction(transaction, conn, {
        preflightCommitment: "confirmed",
        skipPreflight: false,
      });
      setPayStatus("sent");
      // Existing polling will detect the transfer at the deposit address
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // User rejected/cancelled the transaction in their wallet - not a real error
      const isUserRejected =
        /user rejected|user denied|cancelled|canceled|rejected the request/i.test(
          msg,
        ) || (err as { code?: number }).code === 4001; // Standard wallet rejection code

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
    solunaSolPerToken,
    seekerSolPerToken,
    cultSolPerToken,
    rate,
    requiredLamports,
  ]);

  /** Check if wallet has sufficient balance before sending. Used to show "insufficient" flow instead of prompting to sign. */
  const checkBalanceSufficient = useCallback(async (): Promise<{
    reason?: "sol_for_fees" | "token";
    sufficient: boolean;
  }> => {
    if (!publicKey || !connection)
      return { reason: "token", sufficient: false };
    const conn = connection as ConnectionType;
    const pubkey = new PublicKeyFromWeb3(publicKey.toBase58());
    try {
      const solBalance = await conn.getBalance(pubkey);
      if (token === "solana") {
        return {
          reason: solBalance >= requiredLamports ? undefined : "token",
          sufficient: solBalance >= requiredLamports,
        };
      }
      // SPL token: check token balance first, then SOL for fees (so we show "not enough USDC" when they have neither)
      let splTokenMint: PublicKeyType;
      // amountBaseUnits: the amount already in smallest token units (e.g. 1 USDC = 1_000_000)
      // These helper functions (usdcAmountFromUsd, tokenAmountFromUsd, tokenAmountFromUsdWithPrice)
      // already multiply by 10^decimals, so we must NOT scale again.
      let amountBaseUnits: BigNumber;
      if (token === "crust") {
        if (crustSolPerToken == null || crustSolPerToken <= 0 || rate <= 0)
          return { reason: "token", sufficient: false };
        amountBaseUnits = tokenAmountFromUsdWithPrice(
          amountUsd,
          crustSolPerToken,
          rate,
          6,
        );
        splTokenMint = new PublicKeyFromWeb3(CRUST_MINT_MAINNET);
      } else if (token === "pump") {
        if (pumpSolPerToken == null || pumpSolPerToken <= 0 || rate <= 0)
          return { reason: "token", sufficient: false };
        amountBaseUnits = tokenAmountFromUsdWithPrice(
          amountUsd,
          pumpSolPerToken,
          rate,
          6,
        );
        splTokenMint = new PublicKeyFromWeb3(PUMP_MINT_MAINNET);
      } else if (token === "soluna") {
        if (solunaSolPerToken == null || solunaSolPerToken <= 0 || rate <= 0)
          return { reason: "token", sufficient: false };
        amountBaseUnits = tokenAmountFromUsdWithPrice(
          amountUsd,
          solunaSolPerToken,
          rate,
          6,
        );
        splTokenMint = new PublicKeyFromWeb3(SOLUNA_MINT_MAINNET);
      } else if (token === "seeker") {
        if (seekerSolPerToken == null || seekerSolPerToken <= 0 || rate <= 0)
          return { reason: "token", sufficient: false };
        amountBaseUnits = tokenAmountFromUsdWithPrice(
          amountUsd,
          seekerSolPerToken,
          rate,
          6,
        );
        splTokenMint = new PublicKeyFromWeb3(SKR_MINT_MAINNET);
      } else if (token === "cult") {
        if (cultSolPerToken == null || cultSolPerToken <= 0 || rate <= 0)
          return { reason: "token", sufficient: false };
        amountBaseUnits = tokenAmountFromUsdWithPrice(
          amountUsd,
          cultSolPerToken,
          rate,
          6,
        );
        splTokenMint = new PublicKeyFromWeb3(CULT_MINT_MAINNET);
      } else if (token === "usdc") {
        amountBaseUnits = usdcAmountFromUsd(amountUsd);
        splTokenMint = new PublicKeyFromWeb3(USDC_MINT_MAINNET);
      } else if (token === "whitewhale") {
        amountBaseUnits = tokenAmountFromUsd(amountUsd);
        splTokenMint = new PublicKeyFromWeb3(WHITEWHALE_MINT_MAINNET);
      } else if (token === "troll") {
        amountBaseUnits = tokenAmountFromUsd(amountUsd);
        splTokenMint = new PublicKeyFromWeb3(TROLL_MINT_MAINNET);
      } else {
        return { reason: "token", sufficient: false };
      }
      let tokenProgramId = TOKEN_PROGRAM_ID;
      try {
        await getMint(conn, splTokenMint, undefined, TOKEN_PROGRAM_ID);
      } catch {
        try {
          await getMint(
            conn,
            splTokenMint,
            undefined,
            TOKEN_2022_PROGRAM_ID,
          );
          tokenProgramId = TOKEN_2022_PROGRAM_ID;
        } catch {
          return { reason: "token", sufficient: false };
        }
      }
      const senderATA = getAssociatedTokenAddressSync(
        splTokenMint,
        pubkey,
        false,
        tokenProgramId,
      );
      let balance: bigint;
      try {
        const account = await getTokenAccount(
          conn,
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
      const tokenSufficient = BigInt(requiredTokens.toString()) <= balance;
      if (!tokenSufficient)
        return { reason: "token", sufficient: false };
      if (solBalance < MIN_SOL_FOR_TOKEN_TX_LAMPORTS)
        return { reason: "sol_for_fees", sufficient: false };
      return { sufficient: true };
    } catch {
      return { reason: "token", sufficient: false };
    }
  }, [
    connection,
    publicKey,
    token,
    amountUsd,
    crustSolPerToken,
    pumpSolPerToken,
    solunaSolPerToken,
    seekerSolPerToken,
    cultSolPerToken,
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
      <div
        className={`
        flex min-h-screen w-full items-center justify-center bg-background
      `}
      >
        <div
          className={`
          flex flex-col gap-4 rounded-lg border border-border bg-card p-6
          text-center
        `}
        >
          <p className="text-sm text-muted-foreground">
            Missing order. Start checkout from your cart.
          </p>
          <Link
            className={`
              text-primary underline
              hover:underline
            `}
            href="/checkout"
          >
            Back to checkout
          </Link>
        </div>
      </div>
    );
  }

  if (orderLoading) {
    return (
      <div
        className={`
        flex min-h-screen w-full items-center justify-center bg-background
      `}
      >
        <p className="text-sm text-muted-foreground">Loading order…</p>
      </div>
    );
  }

  const isSuiFlow = token === "sui";
  if (isSuiFlow ? !suiFromHash : orderError || !order) {
    return (
      <div
        className={`
        flex min-h-screen w-full items-center justify-center bg-background
      `}
      >
        <div
          className={`
          flex flex-col gap-4 rounded-lg border border-border bg-card p-6
          text-center
        `}
        >
          <p className="text-sm text-muted-foreground">
            {isSuiFlow
              ? (orderError ?? "Invalid Sui link")
              : (orderError ?? "Order not found")}
          </p>
          <Link
            className={`
              text-primary underline
              hover:underline
            `}
            href="/checkout"
          >
            Back to checkout
          </Link>
        </div>
      </div>
    );
  }

  // Show loading until order AND payment data are ready (avoids flash of "Loading QR code...")
  // For non-Sui we allow fallback rate so we don't stay stuck if price API is slow/blocked
  const pricesReady =
    token === "sui" || solUsdRate !== null || (order != null && !orderError);
  const qrReady =
    token === "sui" ||
    qrDataUrl !== null ||
    isExpired ||
    (connected && payStatus !== "idle");

  if (!pricesReady || !qrReady) {
    return (
      <div
        className={`
        flex min-h-screen w-full items-center justify-center bg-background
      `}
      >
        <p className="text-sm text-muted-foreground">Loading order…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background">
      <div
        className={`
        mx-auto w-full max-w-6xl px-4 py-8
        sm:px-5
      `}
      >
        <div
          className={`
          flex min-w-0 flex-col gap-6
          min-[560px]:flex-row min-[560px]:items-start
        `}
        >
          {/* Left: payment box */}
          <div
            className={`
            min-w-0 flex-1 rounded-xl border border-border bg-card p-6
            min-[560px]:min-w-[560px]
          `}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Image
                  alt={logo.alt}
                  className="h-8 w-10 shrink-0 object-contain"
                  height={32}
                  src={logo.src}
                  width={40}
                />
                <h1
                  className={`
                  text-2xl font-semibold tracking-tight
                  md:text-3xl
                `}
                >
                  {title}
                </h1>
              </div>

              {token === "sui" && !getSuiPayRecipient() ? (
                <div
                  className={`
                  flex flex-col gap-6 rounded-lg border border-amber-500/40
                  bg-amber-500/10 p-4
                `}
                >
                  <p
                    className={`
                    text-sm font-medium text-amber-800
                    dark:text-amber-200
                  `}
                  >
                    Sui Payment Kit is not configured. Set
                    NEXT_PUBLIC_SUI_PAY_RECIPIENT in .env.
                  </p>
                  <Link
                    className={`
                      text-primary underline
                      hover:underline
                    `}
                    href="/checkout"
                  >
                    Back to checkout
                  </Link>
                </div>
              ) : isExpired ? (
                <div className="flex flex-col gap-6">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <Clock
                        aria-hidden
                        className="size-5 shrink-0 text-muted-foreground"
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
                      onClick={handleRecreateOrder}
                      size="lg"
                      type="button"
                      variant="secondary"
                    >
                      Recreate order
                    </Button>
                  </div>
                  <div
                    className={`
                    flex items-start gap-3 rounded-lg border border-border
                    bg-muted/30 p-4
                  `}
                  >
                    <Info
                      aria-hidden
                      className="size-5 shrink-0 text-muted-foreground"
                    />
                    <div>
                      <p className="font-semibold">
                        If you already sent a payment
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
                      <div
                        className={`
                        flex min-h-[320px] min-w-[320px] items-center
                        justify-center rounded-lg border border-border bg-muted
                        p-8 text-center text-sm text-muted-foreground
                      `}
                      >
                        Loading CRUST price from pump.fun…
                      </div>
                    ) : token === "pump" && pumpSolPerToken === null ? (
                      <div
                        className={`
                        flex min-h-[320px] min-w-[320px] items-center
                        justify-center rounded-lg border border-border bg-muted
                        p-8 text-center text-sm text-muted-foreground
                      `}
                      >
                        Loading Pump price from pump.fun…
                      </div>
                    ) : token === "soluna" && solunaSolPerToken === null ? (
                      <div
                        className={`
                        flex min-h-[320px] min-w-[320px] items-center
                        justify-center rounded-lg border border-border bg-muted
                        p-8 text-center text-sm text-muted-foreground
                      `}
                      >
                        Loading SOLUNA price from soluna…
                      </div>
                    ) : token === "seeker" && seekerSolPerToken === null ? (
                      <div
                        className={`
                        flex min-h-[320px] min-w-[320px] items-center
                        justify-center rounded-lg border border-border bg-muted
                        p-8 text-center text-sm text-muted-foreground
                      `}
                      >
                        Loading Seeker (SKR) price…
                      </div>
                    ) : token === "crust" && crustSolPerToken === 0 ? (
                      <div
                        className={`
                        flex min-h-[320px] min-w-[320px] flex-col items-center
                        justify-center gap-2 rounded-lg border
                        border-destructive/40 bg-destructive/10 p-8 text-center
                        text-sm text-destructive
                      `}
                      >
                        <AlertCircle aria-hidden className="size-10 shrink-0" />
                        <p className="font-medium">CRUST price unavailable</p>
                        <p className="text-muted-foreground">
                          We couldn&apos;t load the CRUST price. Check your
                          connection and refresh.
                        </p>
                      </div>
                    ) : token === "pump" && pumpSolPerToken === 0 ? (
                      <div
                        className={`
                        flex min-h-[320px] min-w-[320px] flex-col items-center
                        justify-center gap-2 rounded-lg border
                        border-destructive/40 bg-destructive/10 p-8 text-center
                        text-sm text-destructive
                      `}
                      >
                        <AlertCircle aria-hidden className="size-10 shrink-0" />
                        <p className="font-medium">Pump price unavailable</p>
                        <p className="text-muted-foreground">
                          We couldn&apos;t load the Pump price. Check your
                          connection and refresh.
                        </p>
                      </div>
                    ) : token === "soluna" && solunaSolPerToken === 0 ? (
                      <div
                        className={`
                        flex min-h-[320px] min-w-[320px] flex-col items-center
                        justify-center gap-2 rounded-lg border
                        border-destructive/40 bg-destructive/10 p-8 text-center
                        text-sm text-destructive
                      `}
                      >
                        <AlertCircle aria-hidden className="size-10 shrink-0" />
                        <p className="font-medium">SOLUNA price unavailable</p>
                        <p className="text-muted-foreground">
                          We couldn&apos;t load the SOLUNA price. Check your
                          connection and refresh.
                        </p>
                      </div>
                    ) : token === "seeker" && seekerSolPerToken === 0 ? (
                      <div
                        className={`
                        flex min-h-[320px] min-w-[320px] flex-col items-center
                        justify-center gap-2 rounded-lg border
                        border-destructive/40 bg-destructive/10 p-8 text-center
                        text-sm text-destructive
                      `}
                      >
                        <AlertCircle aria-hidden className="size-10 shrink-0" />
                        <p className="font-medium">
                          Seeker (SKR) price unavailable
                        </p>
                        <p className="text-muted-foreground">
                          We couldn&apos;t load the Seeker price. Check your
                          connection and refresh.
                        </p>
                      </div>
                    ) : isMobile && token !== "sui" ? null : qrDataUrl ? (
                      <div className="relative inline-block">
                        <img
                          alt="Payment QR code"
                          className="rounded-lg"
                          height={320}
                          src={qrDataUrl}
                          width={320}
                        />
                        {/* Logo overlay in the center of the QR code */}
                        <div
                          className={`
                          absolute inset-0 flex items-center justify-center
                        `}
                        >
 <div className="rounded-full bg-white p-1.5 ">
                            <img
                              alt=""
                              className="size-9 object-contain"
                              height={36}
                              src={logo.src}
                              width={36}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        aria-hidden
                        className={`
                          flex min-h-[320px] min-w-[320px] items-center
                          justify-center rounded-lg bg-white p-2
                        `}
                      >
                        <div
                          className={`
                          flex flex-col items-center gap-3 text-muted-foreground
                        `}
                        >
                          <div
                            className={`
                            size-6 animate-spin rounded-full border-2
                            border-muted-foreground/30 border-t-muted-foreground
                          `}
                          />
                          <span className="text-sm">Loading QR code…</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {isMobile && token !== "sui" && qrDataUrl && (
                    <Dialog onOpenChange={setShowQrDialog} open={showQrDialog}>
                      <DialogContent
                        className={`
                        flex max-w-[min(360px,100vw)] flex-col items-center
                        gap-4 p-6
                      `}
                      >
                        <DialogTitle className="sr-only">
                          Payment QR code
                        </DialogTitle>
                        <p className="text-center text-sm text-muted-foreground">
                          Scan this QR code with another device to pay
                        </p>
                        <div
                          className={`
                          relative inline-block rounded-lg bg-white p-2
                        `}
                        >
                          <img
                            alt="Payment QR code"
                            className="rounded-lg"
                            height={280}
                            src={qrDataUrl}
                            width={280}
                          />
                          <div
                            className={`
                            absolute inset-0 flex items-center justify-center
                          `}
                          >
                            <div
                              className={`
 rounded-full bg-white p-1.5 
                            `}
                            >
                              <img
                                alt=""
                                className="size-8 object-contain"
                                height={32}
                                src={logo.src}
                                width={32}
                              />
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={() => setShowQrDialog(false)}
                          type="button"
                          variant="outline"
                        >
                          Close
                        </Button>
                      </DialogContent>
                    </Dialog>
                  )}
                  <div
                    className={`
                    rounded-lg border border-border bg-muted/30 p-5
                  `}
                  >
                    <h2 className="mb-5 text-lg font-semibold">
                      Payment details
                    </h2>
                    <div className="space-y-5">
                      <div>
                        <p className="mb-1.5 text-sm text-muted-foreground">
                          Pay to
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <code
                            className={`
                            rounded bg-background px-3 py-1.5 font-mono text-sm
                            break-all
                          `}
                          >
                            {paymentAddress || "—"}
                          </code>
                          <Button
                            className="shrink-0 gap-1.5 text-sm"
                            disabled={!paymentAddress}
                            onClick={copyAddress}
                            size="sm"
                            variant="ghost"
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
                      <div>
                        <p className="mb-1.5 text-sm text-muted-foreground">
                          Amount to pay
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-semibold">
                            {amountDisplayStr} {amountUnit}
                          </span>
                          <Button
                            className="shrink-0 gap-1.5 text-sm"
                            disabled={
                              (token === "crust" && crustSolPerToken == null) ||
                              (token === "pump" && pumpSolPerToken == null) ||
                              (token === "soluna" &&
                                solunaSolPerToken == null) ||
                              (token === "seeker" && seekerSolPerToken == null)
                            }
                            onClick={copyAmount}
                            size="sm"
                            variant="ghost"
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
                      <div>
                        <p className="mb-1.5 text-sm text-muted-foreground">
                          Expires in
                        </p>
                        <p
                          className={`
                          font-mono text-lg font-semibold tabular-nums
                        `}
                        >
                          {formattedTime}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div
                  className={`
                  flex flex-col gap-6 rounded-lg border border-border
                  bg-muted/30 p-6
                `}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {wallet?.adapter.icon && (
                        <img
                          alt=""
                          className="size-8 rounded object-contain"
                          height={32}
                          src={wallet.adapter.icon}
                          width={32}
                        />
                      )}
                      <span className="font-mono text-base">
                        {publicKey
                          ? truncateAddress(publicKey.toBase58())
                          : "—"}
                      </span>
                    </div>
                    <button
                      className={`
                        cursor-pointer text-sm text-destructive
                        hover:underline
                      `}
                      onClick={() => disconnect()}
                      type="button"
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
                      <div
                        className={`
                        flex items-center gap-2 rounded-md border
                        border-green-500/40 bg-green-500/10 p-4
                      `}
                      >
                        <Check
                          className={`
                          size-5 shrink-0 text-green-600
                          dark:text-green-500
                        `}
                        />
                        <p
                          className={`
                          text-sm font-medium text-green-800
                          dark:text-green-200
                        `}
                        >
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
                      <div
                        className={`
                        flex items-start gap-3 rounded-md border
                        border-destructive/40 bg-destructive/10 p-4
                      `}
                      >
                        <AlertCircle
                          className={`
                          size-5 shrink-0 text-destructive
                        `}
                        />
                        <p className="text-sm font-medium text-destructive">
                          {payError ?? "Transaction failed. Please try again."}
                        </p>
                      </div>
                      <Button
                        className="w-full gap-2"
                        onClick={handlePayWithWalletClick}
                        size="lg"
                        type="button"
                      >
                        {wallet?.adapter.icon && (
                          <img
                            alt=""
                            className="size-5 object-contain"
                            height={20}
                            src={wallet.adapter.icon}
                            width={20}
                          />
                        )}
                        Try again with {wallet?.adapter.name ?? "wallet"}
                      </Button>
                      <div className="flex items-center gap-3">
                        <span className="h-px flex-1 bg-border" />
                        <span
                          className={`
                          text-sm font-medium text-muted-foreground
                        `}
                        >
                          or
                        </span>
                        <span className="h-px flex-1 bg-border" />
                      </div>
                      <div className="flex justify-center">
                        <Button
                          className="w-1/2 min-w-0"
                          onClick={handlePayManually}
                          size="lg"
                          type="button"
                          variant="secondary"
                        >
                          Pay manually
                        </Button>
                      </div>
                    </div>
                  )}
                  {payStatus === "insufficient" && (
                    <div className="flex flex-col gap-6">
                      <div
                        className={`
                        flex items-start gap-3 rounded-md border
                        border-amber-500/40 bg-amber-500/10 p-4
                      `}
                      >
                        <AlertCircle
                          className={`
                          size-5 shrink-0 text-amber-600
                          dark:text-amber-500
                        `}
                        />
                        <p
                          className={`
                          text-sm font-medium text-amber-800
                          dark:text-amber-200
                        `}
                        >
                          {insufficientReason === "sol_for_fees"
                            ? `You have enough ${TOKEN_LABEL[token] ?? "funds"} for this order, but you need a small amount of SOL in your wallet for network fees (e.g. ~0.00005 SOL). Add a little SOL and try again, or pay manually below.`
                            : `You don't have enough ${TOKEN_LABEL[token] ?? "funds"} in your wallet for this order${token !== "solana" ? " (you also need a small amount of SOL for network fees)" : ""}. Add funds or pay manually below.`}
                        </p>
                      </div>
                      <Button
                        className="w-full gap-2"
                        onClick={handlePayWithWalletClick}
                        size="lg"
                        type="button"
                      >
                        {wallet?.adapter.icon && (
                          <img
                            alt=""
                            className="size-5 object-contain"
                            height={20}
                            src={wallet.adapter.icon}
                            width={20}
                          />
                        )}
                        Try again with {wallet?.adapter.name ?? "wallet"}
                      </Button>
                      <div className="flex justify-center">
                        <Button
                          className="w-1/2 min-w-0"
                          onClick={handlePayManually}
                          size="lg"
                          type="button"
                          variant="secondary"
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
                  <Button asChild className="min-w-[12rem]" size="lg">
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
                        onClick={() => openConnectWalletModal()}
                        size="lg"
                      >
                        Connect wallet
                      </Button>
                    ) : (
                      <Button
                        className="min-w-[12rem]"
                        onClick={handlePayWithWalletClick}
                        size="lg"
                        type="button"
                        variant="secondary"
                      >
                        Pay with your wallet
                      </Button>
                    )}
                  </div>
                )}
              {/* Scan QR button — mobile only, below Connect / Pay button */}
              {isMobile &&
                token !== "sui" &&
                !isExpired &&
                (!connected || payStatus === "idle") && (
                  <div className="flex justify-center">
                    {qrDataUrl ? (
                      <Button
                        className="gap-2"
                        onClick={() => setShowQrDialog(true)}
                        size="lg"
                        type="button"
                        variant="secondary"
                      >
                        <QrCode aria-hidden className="size-5" />
                        Scan QR with another device
                      </Button>
                    ) : (
                      <div
                        className={`
                        flex flex-col items-center gap-3 text-muted-foreground
                      `}
                      >
                        <div
                          className={`
                          size-6 animate-spin rounded-full border-2
                          border-muted-foreground/30 border-t-muted-foreground
                        `}
                        />
                        <span className="text-sm">Loading QR code…</span>
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>

          {/* Right: Order details box */}
          <div
            className={`
            min-w-0 shrink-0
            min-[560px]:sticky min-[560px]:top-8 min-[560px]:w-[510px]
            min-[560px]:self-start
          `}
          >
            <div className="rounded-xl border border-border bg-card px-6 py-5">
              <h2 className="mb-4 text-xl font-semibold">Order details</h2>
              <dl className="space-y-3 text-base">
                <div
                  className={`
                  flex flex-wrap items-center justify-between gap-2
                `}
                >
                  <dt className="text-muted-foreground">Email address</dt>
                  <dd className="flex items-center gap-2">
                    <span>{email || "—"}</span>
                    {!user?.email && (
                      <button
                        className={`
                          text-primary underline
                          hover:underline
                        `}
                        onClick={() => router.push("/checkout")}
                        type="button"
                      >
                        Change
                      </button>
                    )}
                  </dd>
                </div>
                <div
                  className={`
                  flex flex-wrap items-center justify-between gap-2
                `}
                >
                  <dt className="text-muted-foreground">Payment method</dt>
                  <dd className="flex items-center gap-2">
                    <span>{paymentMethodLabel}</span>
                    <button
                      className={`
                        text-primary underline
                        hover:underline
                      `}
                      onClick={() => router.push("/checkout")}
                      type="button"
                    >
                      Change
                    </button>
                  </dd>
                </div>
                <div
                  className={`
                  flex flex-wrap items-center justify-between gap-2
                `}
                >
                  <dt className="text-muted-foreground">Order ID</dt>
                  <dd>
                    <code className="font-mono text-xs break-all">
                      {pathId || "—"}
                    </code>
                  </dd>
                </div>
                <div
                  className={`
                  flex flex-wrap items-center justify-between gap-2 border-t
                  border-border pt-3
                `}
                >
                  <dt className="text-muted-foreground">Fiat value</dt>
                  <dd className="font-medium">
                    USD {amountUsd > 0 ? amountUsd.toFixed(2) : "0.00"}
                  </dd>
                </div>
                <div
                  className={`
                  flex flex-wrap items-center justify-between gap-2 text-lg
                `}
                >
                  <dt className="font-medium">Total</dt>
                  <dd className="font-semibold">
                    {token === "sui"
                      ? `${amountSuiStr} SUI`
                      : token === "crust"
                        ? `${amountCrustStr} CRUST`
                        : token === "pump"
                          ? `${amountPumpStr} PUMP`
                          : token === "soluna"
                            ? `${amountSolunaStr} SOLUNA`
                            : token === "seeker"
                              ? `${amountSeekerStr} SKR`
                              : token === "cult"
                                ? `${amountCultStr} CULT`
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
              <p
                className={`
                mt-4 flex items-center gap-2 text-sm text-muted-foreground
              `}
              >
                <ArrowLeftRight
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
                {token === "sui"
                  ? `We've converted this price from USD to SUI at our rate of approximately ${rateLabel}. Uses the Sui Payment Kit (sui:pay).`
                  : token === "crust"
                    ? `We've converted this price from USD to CRUST at our rate of approximately ${rateLabel}.`
                    : token === "pump"
                      ? `We've converted this price from USD to PUMP at our rate of approximately ${rateLabel}.`
                      : token === "soluna"
                        ? `We've converted this price from USD to SOLUNA at our rate of approximately ${rateLabel}.`
                        : token === "seeker"
                          ? `We've converted this price from USD to SKR at our rate of approximately ${rateLabel}.`
                          : token === "cult"
                            ? `We've converted this price from USD to CULT at our rate of approximately ${rateLabel}.`
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
      aria-hidden
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.369.022.739.15 1.027.331l.962.562c.1.06.153.166.153.278 0 .16-.13.29-.29.29h-.962a.704.704 0 01-.332-.027 6.57 6.57 0 01-1.027-.331m-7.332 0A2.251 2.251 0 0112 2.25h3a2.25 2.25 0 012.166 1.638m-7.332 0c.369.022.739.15 1.027.331l.962.562c.1.06.153.166.153.278 0 .16-.13.29-.29.29h-.962a.704.704 0 01-.332-.027 6.57 6.57 0 01-1.027-.331M7.5 4.5v12.75a2.25 2.25 0 002.25 2.25h6.75a2.25 2.25 0 002.25-2.25V4.5m-9 0h9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Parse URL hash synchronously (component is ssr:false, window is always available)
function parseSuiHash(): null | {
  suiFromHash: null | { amountUsd: number; expiresAt: string };
  token: "sui";
} {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.slice(1);
  if (!raw.toLowerCase().startsWith("sui-")) return null;
  const parts = raw.split("-");
  const amount = Number.parseFloat(parts[1] ?? "0");
  const expiresTs = Number(parts[2] ?? "0");
  if (Number.isFinite(amount) && amount >= 0 && Number.isFinite(expiresTs)) {
    return {
      suiFromHash: {
        amountUsd: amount,
        expiresAt: new Date(expiresTs).toISOString(),
      },
      token: "sui",
    };
  }
  return { suiFromHash: null, token: "sui" };
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}.....${address.slice(-4)}`;
}
