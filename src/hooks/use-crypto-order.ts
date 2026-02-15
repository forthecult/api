"use client";

import { useEffect, useState } from "react";

export type OrderPaymentInfo = {
  orderId: string;
  depositAddress: string;
  totalCents: number;
  email?: string;
  expiresAt: string;
  /** Solana Pay: which token was selected (solana | usdc | whitewhale | crust | pump | troll | soluna). Used for balance check. */
  token?: string;
};

/**
 * Fetches and manages order state for crypto payments.
 *
 * For Sui tokens the order data comes from the URL hash (suiFromHash),
 * so no API call is made. For all other tokens the order is fetched
 * from `/api/checkout/orders/:orderId`.
 */
export function useCryptoOrder({
  orderId,
  token,
  enabled = true,
  suiFromHash,
}: {
  orderId: string;
  token: string;
  enabled?: boolean;
  suiFromHash?: { amountUsd: number; expiresAt: string } | null;
}): {
  order: OrderPaymentInfo | null;
  loading: boolean;
  error: string | null;
} {
  const [order, setOrder] = useState<OrderPaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    if (token === "sui") {
      setLoading(false);
      setError(
        suiFromHash
          ? null
          : "Invalid Sui link: missing amount or expiry in URL hash.",
      );
      return;
    }

    if (!orderId?.trim()) {
      setLoading(false);
      setError("Missing order");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/checkout/orders/${encodeURIComponent(orderId)}`)
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
        }
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load order");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, orderId, enabled, suiFromHash]);

  return { order, loading, error };
}
