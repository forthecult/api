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

// Detect payment type from hash: #eth (EVM), #btcpay (Bitcoin/Doge/Monero), #ton, #solana, #crust, #sui-...
// The order type is determined by the API based on what was created
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
  return "solana";
}

export function CryptoPayLoader() {
  const [paymentType, setPaymentType] = useState<
    "eth" | "btcpay" | "ton" | "solana" | null
  >(null);

  useEffect(() => {
    setPaymentType(getPaymentTypeFromHash());

    const handleHashChange = () => {
      setPaymentType(getPaymentTypeFromHash());
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

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
