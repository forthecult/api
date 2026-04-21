"use client";

import { useEffect, useState } from "react";

/** Partial order from prefetch (layout); when present, skip fetch. */
export type InitialOrderLike = Record<string, unknown> & {
  depositAddress?: string;
  email?: string;
  expiresAt?: string;
  orderId?: string;
  token?: string;
  totalCents?: number;
};

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
 * so no API call is made. When initialOrder is provided (e.g. from layout
 * prefetch), it is used and no fetch is made. Otherwise the order is
 * fetched from `/api/checkout/orders/:orderId`.
 */
export function useCryptoOrder({
  enabled = true,
  initialOrder,
  orderId,
  suiFromHash,
  token,
}: {
  enabled?: boolean;
  /** When set, use this and skip fetch (earlier data from layout). */
  initialOrder?: InitialOrderLike | null;
  orderId: string;
  suiFromHash?: null | { amountUsd: number; expiresAt: string };
  token: string;
}): {
  error: null | string;
  loading: boolean;
  order: null | OrderPaymentInfo;
} {
  const normalizedInitial = initialOrder
    ? {
        depositAddress: String(initialOrder.depositAddress ?? ""),
        email:
          typeof initialOrder.email === "string"
            ? initialOrder.email
            : undefined,
        expiresAt: String(initialOrder.expiresAt ?? ""),
        orderId: String(initialOrder.orderId ?? ""),
        token:
          typeof initialOrder.token === "string"
            ? initialOrder.token
            : undefined,
        totalCents: Number(initialOrder.totalCents) || 0,
      }
    : null;

  const [order, setOrder] = useState<null | OrderPaymentInfo>(
    normalizedInitial,
  );
  const [loading, setLoading] = useState(!normalizedInitial);
  const [error, setError] = useState<null | string>(null);

  useEffect(() => {
    if (!enabled) return;
    if (normalizedInitial) return;

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
      .then((raw: unknown) => {
        const data = raw as OrderPaymentInfo;
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
  }, [token, orderId, enabled, suiFromHash, normalizedInitial]);

  return { error, loading, order };
}
