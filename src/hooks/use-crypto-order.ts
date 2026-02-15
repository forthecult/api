"use client";

import { useEffect, useState } from "react";

export interface OrderPaymentInfo {
  depositAddress: string;
  email?: string;
  expiresAt: string;
  orderId: string;
  /** Solana Pay: which token was selected (solana | usdc | whitewhale | crust | pump | troll | soluna). Used for balance check. */
  token?: string;
  totalCents: number;
}

/**
 * Fetches and manages order state for crypto payments.
 *
 * For Sui tokens the order data comes from the URL hash (suiFromHash),
 * so no API call is made. For all other tokens the order is fetched
 * from `/api/checkout/orders/:orderId`.
 */
export function useCryptoOrder({
  enabled = true,
  orderId,
  suiFromHash,
  token,
}: {
  enabled?: boolean;
  orderId: string;
  suiFromHash?: null | { amountUsd: number; expiresAt: string };
  token: string;
}): {
  error: null | string;
  loading: boolean;
  order: null | OrderPaymentInfo;
} {
  const [order, setOrder] = useState<null | OrderPaymentInfo>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);

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

  return { error, loading, order };
}
