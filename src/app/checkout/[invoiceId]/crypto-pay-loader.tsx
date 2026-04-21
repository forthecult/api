"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Skeleton } from "~/ui/primitives/skeleton";

import { useOrderPrefetch } from "./order-prefetch-context";

const CryptoPayClient = dynamic(
  () => import("../crypto/CryptoPayClient").then((m) => m.CryptoPayClient),
  {
    loading: () => (
      <div
        className={`
          flex min-h-screen w-full items-center justify-center bg-background
        `}
      >
        <p className="text-sm text-muted-foreground">Loading order…</p>
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

export function CryptoPayLoader() {
  const params = useParams();
  const orderId = (params?.invoiceId as string) ?? "";
  const prefetch = useOrderPrefetch();
  const [paymentType, setPaymentType] = useState<
    "btcpay" | "eth" | "solana" | "ton" | null
  >(() => getPaymentTypeFromHash());

  // When no hash, get payment type from prefetched order (layout already fetched)
  useEffect(() => {
    if (paymentType !== null) return;
    if (!orderId?.trim()) {
      setPaymentType("solana");
      return;
    }
    if (prefetch?.orderLoading) return;
    const pt = prefetch?.order?.paymentType?.toLowerCase();
    if (pt === "eth" || pt === "btcpay" || pt === "ton" || pt === "solana")
      setPaymentType(pt);
    else setPaymentType("solana");
  }, [
    orderId,
    paymentType,
    prefetch?.order?.paymentType,
    prefetch?.orderLoading,
  ]);

  useEffect(() => {
    const handleHashChange = () => {
      const fromHash = getPaymentTypeFromHash();
      if (fromHash) setPaymentType(fromHash);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Remove crypto hash from URL for all crypto payment methods (clean URL)
  useEffect(() => {
    if (typeof window === "undefined" || !window.location.hash) return;
    const hash = window.location.hash.slice(1).toLowerCase();
    if (
      hash === "eth" ||
      hash === "solana" ||
      hash === "ton" ||
      hash.startsWith("sui-") ||
      hash === "bitcoin" ||
      hash === "doge" ||
      hash === "dogecoin" ||
      hash === "monero"
    ) {
      const url = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", url);
    }
  }, []);

  const initialOrder = prefetch?.order ?? undefined;
  if (paymentType === "eth")
    return <EthPayClient initialOrder={initialOrder} />;
  if (paymentType === "btcpay")
    return <BtcPayClient initialOrder={initialOrder} />;
  if (paymentType === "ton")
    return <TonPayClient initialOrder={initialOrder} />;
  if (paymentType === "solana")
    return <CryptoPayClient initialOrder={initialOrder} />;

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

// Detect payment type from hash when present: #eth, #btcpay, #ton, #solana, #sui-...
// When no hash, fetch order and use paymentType from API (no crypto in URL).
function getPaymentTypeFromHash(): "btcpay" | "eth" | "solana" | "ton" | null {
  if (typeof window === "undefined") return null;
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
  if (hash === "solana" || hash.startsWith("sui-")) return "solana";
  return null;
}
