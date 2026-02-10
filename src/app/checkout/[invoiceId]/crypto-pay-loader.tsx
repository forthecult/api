"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
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
// When no hash, payment type is loaded from the order API (clean URL).
function getPaymentTypeFromHash(): "eth" | "btcpay" | "ton" | "solana" | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.slice(1).toLowerCase();
  if (!hash) return null;
  if (hash === "eth") return "eth";
  if (
    hash === "bitcoin" ||
    hash === "doge" ||
    hash === "dogecoin" ||
    hash === "monero"
  )
    return "btcpay";
  if (hash === "ton") return "ton";
  if (hash.startsWith("sui-")) return "solana";
  return "solana";
}

export function CryptoPayLoader() {
  const params = useParams();
  const orderId = (params?.invoiceId as string) ?? "";
  const [paymentType, setPaymentType] = useState<
    "eth" | "btcpay" | "ton" | "solana" | null
  >(null);
  const [fetchedFromApi, setFetchedFromApi] = useState(false);

  useEffect(() => {
    const fromHash = getPaymentTypeFromHash();
    if (fromHash) {
      setPaymentType(fromHash);
      setFetchedFromApi(false);
      return;
    }
    // No hash: fetch order and use paymentType from API (clean URL)
    if (!orderId?.trim()) {
      setPaymentType(null);
      return;
    }
    let cancelled = false;
    setPaymentType(null);
    setFetchedFromApi(true);
    fetch(`/api/checkout/orders/${encodeURIComponent(orderId)}`)
      .then((res) => {
        if (!res.ok || cancelled) return null;
        return res.json();
      })
      .then((data: { paymentType?: "eth" | "btcpay" | "ton" | "solana" }) => {
        if (cancelled) return;
        if (data?.paymentType) setPaymentType(data.paymentType);
        else setPaymentType("solana");
      })
      .catch(() => {
        if (!cancelled) setPaymentType("solana");
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    if (fetchedFromApi) return;
    const handleHashChange = () => {
      const fromHash = getPaymentTypeFromHash();
      if (fromHash) setPaymentType(fromHash);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [fetchedFromApi]);

  if (paymentType === null) {
    return (
      <div className="container mx-auto py-8">
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (paymentType === "eth") return <EthPayClient />;
  if (paymentType === "btcpay") return <BtcPayClient />;
  if (paymentType === "ton") return <TonPayClient />;

  return <CryptoPayClient />;
}
