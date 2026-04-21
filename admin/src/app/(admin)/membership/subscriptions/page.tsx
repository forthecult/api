"use client";

import {
  ChevronLeft,
  ChevronRight,
  Crown,
  Search,
  Shield,
  Star,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

interface SubscriptionListResponse {
  items: SubscriptionRow[];
  limit: number;
  page: number;
  totalCount: number;
  totalPages: number;
}

interface SubscriptionRow {
  billingProvider: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: null | string;
  email: string;
  id: string;
  interval: string;
  name: string;
  status: string;
  tier: number;
  tierName: string;
  userId: string;
}

const TIER_CONFIG: Record<
  number,
  {
    accent: string;
    bg: string;
    icon: React.ComponentType<{ className?: string }>;
    name: string;
  }
> = {
  1: {
    accent: "text-amber-500",
    bg: "bg-amber-500/10",
    icon: Crown,
    name: "APEX",
  },
  2: {
    accent: "text-purple-500",
    bg: "bg-purple-500/10",
    icon: Star,
    name: "PRIME",
  },
  3: { accent: "text-blue-500", bg: "bg-blue-500/10", icon: Zap, name: "BASE" },
};

export default function AdminMembershipSubscriptionsPage() {
  const [data, setData] = useState<null | SubscriptionListResponse>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"1" | "2" | "3" | "">("");
  const [providerFilter, setProviderFilter] = useState<
    "" | "paypal" | "stripe"
  >("");

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "20", page: String(page) });
      if (tierFilter) params.set("tier", tierFilter);
      if (providerFilter) params.set("provider", providerFilter);
      const res = await fetch(
        `${API_BASE}/api/admin/membership/subscriptions?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as SubscriptionListResponse;
      setData(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load subscriptions",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, providerFilter, tierFilter]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const filteredItems = data?.items.filter((m) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(term) ||
      m.email.toLowerCase().includes(term)
    );
  });

  if (error) {
    return (
      <div
        className={`
          rounded-lg border border-red-200 bg-red-50 p-4 text-red-800
          dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
        `}
      >
        {error}
        <Button className="mt-2" onClick={() => void fetchList()} type="button">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className={`
          flex flex-col gap-4
          sm:flex-row sm:items-center sm:justify-between
        `}
      >
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Membership subscriptions
          </h2>
          <p className="text-sm text-muted-foreground">
            Recurring card billing (Stripe and PayPal) — monthly or annual
          </p>
        </div>
        {data && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {data.totalCount} subscription{data.totalCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      <Card>
        <CardHeader
          className={`
            flex flex-col gap-4
            sm:flex-row sm:items-center sm:justify-between
          `}
        >
          <CardTitle className="sr-only">Subscription list</CardTitle>
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative max-w-md flex-1">
              <Search
                className={`
                  absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2
                  text-muted-foreground
                `}
              />
              <input
                aria-label="Search subscriptions"
                autoComplete="off"
                className={cn(
                  `
                    w-full rounded-md border border-input bg-background py-2
                    pr-3 pl-9 text-sm
                  `,
                  `
                    placeholder:text-muted-foreground
                    focus:ring-2 focus:ring-ring focus:outline-none
                  `,
                )}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setSearch(e.target.value);
                }}
                placeholder="Search by name or email…"
                type="text"
                value={searchInput}
              />
            </div>
            <select
              aria-label="Filter by tier"
              className={`
                rounded-md border border-input bg-background px-3 py-2 text-sm
                focus:ring-2 focus:ring-ring focus:outline-none
              `}
              onChange={(e) => {
                setTierFilter(e.target.value as "1" | "2" | "3" | "");
                setPage(1);
              }}
              value={tierFilter}
            >
              <option value="">All tiers</option>
              <option value="1">APEX</option>
              <option value="2">PRIME</option>
              <option value="3">BASE</option>
            </select>
            <select
              aria-label="Filter by provider"
              className={`
                rounded-md border border-input bg-background px-3 py-2 text-sm
                focus:ring-2 focus:ring-ring focus:outline-none
              `}
              onChange={(e) => {
                setProviderFilter(e.target.value as "" | "paypal" | "stripe");
                setPage(1);
              }}
              value={providerFilter}
            >
              <option value="">All providers</option>
              <option value="stripe">Stripe</option>
              <option value="paypal">PayPal</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div
              className={`
                flex min-h-[200px] items-center justify-center
                text-muted-foreground
              `}
            >
              Loading…
            </div>
          ) : data && filteredItems ? (
            <>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className={`
                        border-b border-border bg-muted/50 text-left text-xs
                        font-semibold tracking-wider text-muted-foreground
                        uppercase
                      `}
                    >
                      <th className="p-4 font-medium whitespace-nowrap">
                        Tier
                      </th>
                      <th className="p-4 font-medium whitespace-nowrap">
                        Provider
                      </th>
                      <th className="p-4 font-medium whitespace-nowrap">
                        Status
                      </th>
                      <th className="p-4 font-medium whitespace-nowrap">
                        Interval
                      </th>
                      <th className="p-4 font-medium whitespace-nowrap">
                        Renews / ends
                      </th>
                      <th className="p-4 font-medium whitespace-nowrap">
                        Customer
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td
                          className="p-8 text-center text-muted-foreground"
                          colSpan={6}
                        >
                          {search.trim() || tierFilter || providerFilter
                            ? "No subscriptions match your filters."
                            : "No subscriptions yet."}
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((row) => {
                        const tierConfig = getTierConfig(row.tier);
                        const TierIcon = tierConfig.icon;
                        return (
                          <tr
                            className={`
                            border-b
                            last:border-0
                          `}
                            key={row.id}
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    `
                                      flex h-8 w-8 items-center justify-center
                                      rounded-lg
                                    `,
                                    tierConfig.bg,
                                  )}
                                >
                                  <TierIcon
                                    className={cn("h-4 w-4", tierConfig.accent)}
                                  />
                                </div>
                                <span className="font-medium">
                                  {tierConfig.name}
                                </span>
                              </div>
                            </td>
                            <td className="p-4 text-muted-foreground capitalize">
                              {row.billingProvider}
                            </td>
                            <td className="p-4">
                              <span className="font-medium">{row.status}</span>
                              {row.cancelAtPeriodEnd ? (
                                <span className="ml-1 text-xs text-amber-600">
                                  (cancel at period end)
                                </span>
                              ) : null}
                            </td>
                            <td className="p-4 capitalize">{row.interval}</td>
                            <td className="p-4 text-muted-foreground">
                              {formatDate(row.currentPeriodEnd)}
                            </td>
                            <td className="p-4">
                              <Link
                                className={`
                                  font-medium text-primary underline-offset-2
                                  hover:underline
                                `}
                                href={`/customers/${row.userId}`}
                              >
                                {row.name}
                              </Link>
                              <span
                                className={`
                                block truncate text-xs text-muted-foreground
                              `}
                              >
                                {row.email}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {data.totalPages > 1 && (
                <div
                  className={`
                    mt-4 flex items-center justify-center gap-2 border-t pt-4
                  `}
                >
                  <Button
                    aria-label="Previous page"
                    className="h-8 w-8 p-0"
                    disabled={data.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {data.page} of {data.totalPages}
                  </span>
                  <Button
                    aria-label="Next page"
                    className="h-8 w-8 p-0"
                    disabled={data.page >= data.totalPages}
                    onClick={() =>
                      setPage((p) => Math.min(data.totalPages, p + 1))
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(s: null | string): string {
  if (!s) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
    }).format(new Date(s));
  } catch {
    return "—";
  }
}

function getTierConfig(tier: number) {
  return (
    TIER_CONFIG[tier] ?? {
      accent: "text-muted-foreground",
      bg: "bg-muted",
      icon: Shield,
      name: `Tier ${tier}`,
    }
  );
}
