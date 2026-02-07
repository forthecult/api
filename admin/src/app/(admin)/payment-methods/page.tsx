"use client";

import { CreditCard } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getMainAppUrl } from "~/lib/env";
import { cn } from "~/lib/cn";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

type PaymentMethodRow = {
  methodKey: string;
  label: string;
  enabled: boolean;
  displayOrder: number;
};

export default function AdminPaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMethods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/payment-methods`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { data: PaymentMethodRow[] };
      setMethods(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setMethods([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMethods();
  }, [fetchMethods]);

  const setEnabled = useCallback(
    async (methodKey: string, enabled: boolean) => {
      setToggling(methodKey);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/admin/payment-methods`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ methodKey, enabled }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setMethods((prev) =>
          prev.map((m) =>
            m.methodKey === methodKey ? { ...m, enabled } : m,
          ),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update");
      } finally {
        setToggling(null);
      }
    },
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Payment methods
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enable or disable payment options. Disabled methods are removed from
          the storefront checkout and product pages.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5" />
            All payment methods
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Toggle off to hide a payment method from customers.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : methods.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No payment methods found. The API will seed defaults on first
              load.
            </p>
          ) : (
            <ul className="space-y-2">
              {methods.map((m) => (
                <li
                  key={m.methodKey}
                  className={cn(
                    "flex items-center justify-between gap-4 rounded-lg border px-4 py-3",
                    m.enabled
                      ? "border-border bg-card"
                      : "border-border/60 bg-muted/30",
                  )}
                >
                  <span
                    className={cn(
                      "font-medium",
                      !m.enabled && "text-muted-foreground",
                    )}
                  >
                    {m.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs",
                        m.enabled
                          ? "text-muted-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {m.enabled ? "Enabled" : "Disabled"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={m.enabled}
                      disabled={toggling === m.methodKey}
                      onClick={() => setEnabled(m.methodKey, !m.enabled)}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                        m.enabled ? "bg-primary" : "bg-input",
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition",
                          m.enabled ? "translate-x-5" : "translate-x-1",
                        )}
                      />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
