"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { Skeleton } from "~/ui/primitives/skeleton";

const CryptoPayClient = dynamic(
  () => import("../crypto/CryptoPayClient").then((m) => m.CryptoPayClient),
  {
    loading: () => (
      <div className="container mx-auto py-8">
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    ),
    ssr: false, // Wallet adapters need browser APIs
  },
);

const EthPayClient = dynamic(
  () => import("../eth/EthPayClient").then((m) => m.EthPayClient),
  {
    loading: () => (
      <div className="container mx-auto py-8">
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    ),
    ssr: false, // Wallet adapters need browser APIs
  },
);

const BtcPayClient = dynamic(
  () => import("../btcpay/BtcPayClient").then((m) => m.BtcPayClient),
  {
    loading: () => (
      <div className="container mx-auto py-8">
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    ),
    ssr: false,
  },
);

const TonPayClient = dynamic(
  () => import("../ton/TonPayClient").then((m) => m.TonPayClient),
  {
    loading: () => (
      <div className="container mx-auto py-8">
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    ),
    ssr: false,
  },
);

// Detect payment type from hash when present: #eth, #btcpay, #ton, #solana, #sui-...
// When no hash, defaults to "solana" (most common) — the payment client
// determines the correct token from the order API anyway.
function getPaymentType(): "eth" | "btcpay" | "ton" | "solana" {
  if (typeof window === "undefined") return "solana";
  const hash = window.location.hash.slice(1).toLowerCase();
  if (hash === "eth") return "eth";
  if (
    hash === "bitcoin" ||
    hash === "doge" ||
    hash === "dogecoin" ||
    hash === "monero"
  )
    return "btcpay";
  if (hash === "ton") return "ton";
  // Default: Solana Pay (SOL, USDC, CRUST, PUMP, TROLL, SUI, WhiteWhale)
  return "solana";
}

export function CryptoPayLoader() {
  // Synchronous initial state — avoids skeleton flash + extra API call
  const [paymentType, setPaymentType] = useState<
    "eth" | "btcpay" | "ton" | "solana"
  >(() => getPaymentType());

  useEffect(() => {
    const handleHashChange = () => setPaymentType(getPaymentType());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  if (paymentType === "eth") return <EthPayClient />;
  if (paymentType === "btcpay") return <BtcPayClient />;
  if (paymentType === "ton") return <TonPayClient />;

  return <CryptoPayClient />;
}
