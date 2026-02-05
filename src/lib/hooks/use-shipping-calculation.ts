"use client";

import { useCallback, useEffect, useState } from "react";

interface CartItem {
  id: string;
  quantity: number;
}

interface UseShippingCalculationOptions {
  countryCode: string;
  orderValueCents: number;
  items: CartItem[];
  enabled?: boolean;
}

interface ShippingResult {
  shippingCents: number;
  label: string | null;
  freeShipping: boolean;
}

interface UseShippingCalculationResult {
  shippingCents: number;
  shippingLabel: string | null;
  freeShipping: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook for calculating shipping costs based on country, order value, and items.
 * Fetches from /api/shipping/calculate endpoint.
 */
export function useShippingCalculation({
  countryCode,
  orderValueCents,
  items,
  enabled = true,
}: UseShippingCalculationOptions): UseShippingCalculationResult {
  const [shippingCents, setShippingCents] = useState(0);
  const [shippingLabel, setShippingLabel] = useState<string | null>(null);
  const [freeShipping, setFreeShipping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchShipping = useCallback(async () => {
    if (!enabled || !countryCode.trim()) {
      setShippingCents(0);
      setShippingLabel(null);
      setFreeShipping(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/shipping/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode: countryCode.trim().toUpperCase(),
          orderValueCents,
          items: items.map((i) => ({ productId: i.id, quantity: i.quantity })),
        }),
      });

      if (!res.ok) {
        // Non-fatal: default to free shipping
        setShippingCents(0);
        setShippingLabel(null);
        setFreeShipping(false);
        return;
      }

      const data = (await res.json()) as ShippingResult;
      setShippingCents(data.shippingCents ?? 0);
      setShippingLabel(data.label ?? null);
      setFreeShipping(data.freeShipping ?? false);
    } catch (err) {
      console.error("Shipping calculation error:", err);
      setError("Failed to calculate shipping");
      setShippingCents(0);
      setShippingLabel(null);
      setFreeShipping(false);
    } finally {
      setLoading(false);
    }
  }, [enabled, countryCode, orderValueCents, items]);

  // Debounce fetch on dependency changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchShipping();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [fetchShipping]);

  return {
    shippingCents,
    shippingLabel,
    freeShipping,
    loading,
    error,
    refetch: fetchShipping,
  };
}
