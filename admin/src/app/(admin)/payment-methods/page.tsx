"use client";

import { ChevronDown, ChevronRight, CreditCard } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getAdminApiBaseUrl } from "~/lib/env";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getAdminApiBaseUrl();

interface PaymentMethodRow {
  displayOrder: number;
  enabled: boolean;
  enabledNetworks?: null | string[];
  label: string;
  methodKey: string;
}

/** Networks that can be toggled per method (stablecoins). */
const METHOD_NETWORKS: Record<string, { label: string; value: string }[]> = {
  stablecoin_usdc: [
    { label: "Solana", value: "solana" },
    { label: "Ethereum", value: "ethereum" },
    { label: "Arbitrum", value: "arbitrum" },
    { label: "Base", value: "base" },
    { label: "Polygon", value: "polygon" },
  ],
  stablecoin_usdt: [
    { label: "Ethereum", value: "ethereum" },
    { label: "Arbitrum", value: "arbitrum" },
    { label: "BNB Smart Chain", value: "bnb" },
    { label: "Polygon", value: "polygon" },
  ],
};

export default function AdminPaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<null | string>(null);
  const [networkSaving, setNetworkSaving] = useState<null | string>(null);
  const [expandedNetworks, setExpandedNetworks] = useState<Set<string>>(
    new Set(),
  );
  const [error, setError] = useState<null | string>(null);

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
          body: JSON.stringify({ enabled, methodKey }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setMethods((prev) =>
          prev.map((m) => (m.methodKey === methodKey ? { ...m, enabled } : m)),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update");
      } finally {
        setToggling(null);
      }
    },
    [],
  );

  const setEnabledNetworks = useCallback(
    async (methodKey: string, enabledNetworks: null | string[]) => {
      setNetworkSaving(methodKey);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/admin/payment-methods`, {
          body: JSON.stringify({ enabledNetworks, methodKey }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setMethods((prev) =>
          prev.map((m) =>
            m.methodKey === methodKey ? { ...m, enabledNetworks } : m,
          ),
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update networks",
        );
      } finally {
        setNetworkSaving(null);
      }
    },
    [],
  );

  const toggleNetwork = useCallback(
    (methodKey: string, networkValue: string, checked: boolean) => {
      const method = methods.find((m) => m.methodKey === methodKey);
      const options = METHOD_NETWORKS[methodKey];
      if (!method || !options) return;
      const current =
        method.enabledNetworks && method.enabledNetworks.length > 0
          ? method.enabledNetworks
          : options.map((o) => o.value);
      const next = checked
        ? [...current, networkValue]
        : current.filter((v) => v !== networkValue);
      const toSave = next.length === options.length ? null : next;
      setEnabledNetworks(methodKey, toSave);
    },
    [methods, setEnabledNetworks],
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
        <div
          className={`
            rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3
            text-sm text-destructive
          `}
        >
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
              {methods.map((m) => {
                const networks = METHOD_NETWORKS[m.methodKey];
                const hasNetworks = Boolean(networks?.length);
                const expanded = expandedNetworks.has(m.methodKey);
                const effectiveNetworks =
                  m.enabledNetworks?.length && m.enabledNetworks.length > 0
                    ? m.enabledNetworks
                    : (networks?.map((n) => n.value) ?? []);
                return (
                  <li
                    className={cn(
                      "rounded-lg border",
                      m.enabled
                        ? "border-border bg-card"
                        : "border-border/60 bg-muted/30",
                    )}
                    key={m.methodKey}
                  >
                    <div
                      className={`
                        flex items-center justify-between gap-4 px-4 py-3
                      `}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {hasNetworks && (
                          <button
                            aria-expanded={expanded}
                            className={`
                              shrink-0 rounded p-0.5 text-muted-foreground
                              hover:bg-muted hover:text-foreground
                            `}
                            onClick={() =>
                              setExpandedNetworks((prev) => {
                                const next = new Set(prev);
                                if (next.has(m.methodKey))
                                  next.delete(m.methodKey);
                                else next.add(m.methodKey);
                                return next;
                              })
                            }
                            type="button"
                          >
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        <span
                          className={cn(
                            "font-medium",
                            !m.enabled && "text-muted-foreground",
                          )}
                        >
                          {m.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn("text-xs", "text-muted-foreground")}
                        >
                          {m.enabled ? "Enabled" : "Disabled"}
                        </span>
                        <button
                          aria-checked={m.enabled}
                          className={cn(
                            `
                              relative inline-flex h-6 w-11 shrink-0
                              cursor-pointer items-center rounded-full border-2
                              border-transparent transition-colors
                              focus-visible:ring-2 focus-visible:ring-ring
                              focus-visible:ring-offset-2
                              focus-visible:outline-none
                              disabled:pointer-events-none disabled:opacity-50
                            `,
                            m.enabled ? "bg-primary" : "bg-input",
                          )}
                          disabled={toggling === m.methodKey}
                          onClick={() => setEnabled(m.methodKey, !m.enabled)}
                          role="switch"
                          type="button"
                        >
                          <span
                            className={cn(
                              `
                                pointer-events-none inline-block h-5 w-5
                                transform rounded-full bg-white shadow ring-0
                                transition
                              `,
                              m.enabled ? "translate-x-5" : "translate-x-1",
                            )}
                          />
                        </button>
                      </div>
                    </div>
                    {hasNetworks && expanded && (
                      <div
                        className={`
                          border-t border-border bg-muted/20 px-4 py-3
                        `}
                      >
                        <p
                          className={`
                            mb-2 text-xs font-medium text-muted-foreground
                          `}
                        >
                          Enabled networks (uncheck to hide from checkout)
                        </p>
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                          {networks!.map((n) => {
                            const isChecked = effectiveNetworks.includes(
                              n.value,
                            );
                            return (
                              <label
                                className={`
                                  flex cursor-pointer items-center gap-2 text-sm
                                `}
                                key={n.value}
                              >
                                <input
                                  checked={isChecked}
                                  className={`
                                    h-4 w-4 rounded border-input text-primary
                                    focus:ring-primary
                                  `}
                                  disabled={
                                    networkSaving === m.methodKey || !m.enabled
                                  }
                                  onChange={(e) =>
                                    toggleNetwork(
                                      m.methodKey,
                                      n.value,
                                      e.target.checked,
                                    )
                                  }
                                  type="checkbox"
                                />
                                <span>{n.label}</span>
                              </label>
                            );
                          })}
                        </div>
                        {networkSaving === m.methodKey && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Saving…
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
