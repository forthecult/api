"use client";

import { useCallback, useEffect, useState } from "react";

interface CartItem {
  id: string;
  quantity: number;
}

interface ShippingResult {
  freeShipping: boolean;
  label: null | string;
  shippingCents: number;
}

interface UseShippingCalculationOptions {
  countryCode: string;
  enabled?: boolean;
  items: CartItem[];
  orderValueCents: number;
}

interface UseShippingCalculationResult {
  error: null | string;
  freeShipping: boolean;
  loading: boolean;
  refetch: () => void;
  shippingCents: number;
  shippingLabel: null | string;
}

/**
 * Hook for calculating shipping costs based on country, order value, and items.
 * Fetches from /api/shipping/calculate endpoint.
 */
export function useShippingCalculation({
  countryCode,
  enabled = true,
  items,
  orderValueCents,
}: UseShippingCalculationOptions): UseShippingCalculationResult {
  const [shippingCents, setShippingCents] = useState(0);
  const [shippingLabel, setShippingLabel] = useState<null | string>(null);
  const [freeShipping, setFreeShipping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<null | string>(null);

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
        body: JSON.stringify({
          countryCode: countryCode.trim().toUpperCase(),
          items: items.map((i) => ({ productId: i.id, quantity: i.quantity })),
          orderValueCents,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
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
    error,
    freeShipping,
    loading,
    refetch: fetchShipping,
    shippingCents,
    shippingLabel,
  };
}
