"use client";

import { useCallback, useEffect, useState } from "react";

import type { PaymentMethodSetting } from "~/lib/payment-method-settings";
import { getPaymentVisibility } from "~/lib/checkout-payment-options";
import type { PaymentVisibility } from "~/lib/checkout-payment-options";

export function usePaymentMethodSettings(): {
  data: PaymentMethodSetting[] | null;
  visibility: PaymentVisibility | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<PaymentMethodSetting[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMethods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payment-methods", { credentials: "include" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { data?: PaymentMethodSetting[] };
      const list = json.data ?? [];
      setData(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payment methods");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMethods();
  }, [fetchMethods]);

  const visibility = data ? getPaymentVisibility(data) : null;

  return {
    data,
    visibility,
    loading,
    error,
    refetch: fetchMethods,
  };
}
