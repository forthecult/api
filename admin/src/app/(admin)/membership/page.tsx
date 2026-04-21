"use client";

import {
  ChevronLeft,
  ChevronRight,
  Crown,
  ExternalLink,
  Search,
  Shield,
  Star,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

interface MemberRow {
  createdAt: null | string;
  email: string;
  id: string;
  image: null | string;
  lock: null | {
    durationLabel: string;
    isLocked: boolean;
    secondsRemaining: number;
    stakedAt: string;
    unlocksAt: string;
  };
  memberSince: null | string;
  name: string;
  orderCount: number;
  stakedBalance: string;
  stakedBalanceRaw: string;
  tier: null | number;
  walletAddress: null | string;
}

interface MembershipListResponse {
  items: MemberRow[];
  limit: number;
  page: number;
  tokenSymbol: string;
  totalCount: number;
  totalPages: number;
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

export default function AdminMembershipPage() {
  const [data, setData] = useState<MembershipListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"1" | "2" | "3" | "">("");

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "20", page: String(page) });
      if (tierFilter) params.set("tier", tierFilter);
      const res = await fetch(
        `${API_BASE}/api/admin/membership?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as MembershipListResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, tierFilter]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  // client-side search filter (since API doesn't support search yet)
  const filteredItems = data?.items.filter((m) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(term) ||
      m.email.toLowerCase().includes(term) ||
      (m.walletAddress?.toLowerCase().includes(term) ?? false)
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
        <Button
          className="mt-2"
          onClick={() => void fetchMembers()}
          type="button"
        >
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
          <h2 className="text-2xl font-semibold tracking-tight">Membership</h2>
          <p className="text-sm text-muted-foreground">
            Members with active on-chain stakes (subscription billing is under
            Membership → Subscriptions)
          </p>
        </div>
        {data && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Crown className="h-4 w-4" />
            <span>
              {data.totalCount} total member{data.totalCount !== 1 ? "s" : ""}
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
          <CardTitle className="sr-only">Member list</CardTitle>
          <div className="flex flex-1 items-center gap-3">
            <div className="relative max-w-md flex-1">
              <Search
                className={`
                  absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2
                  text-muted-foreground
                `}
              />
              <input
                aria-label="Search members"
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
                placeholder="Search by name, email, or wallet…"
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
                        Member Since
                      </th>
                      <th className="p-4 font-medium whitespace-nowrap">
                        Customer
                      </th>
                      <th
                        className={`
                        p-4 text-right font-medium whitespace-nowrap
                      `}
                      >
                        Orders
                      </th>
                      <th
                        className={`
                        p-4 text-right font-medium whitespace-nowrap
                      `}
                      >
                        Staked
                      </th>
                      <th className="p-4 font-medium whitespace-nowrap">
                        Lock Status
                      </th>
                      <th className="p-4 font-medium whitespace-nowrap">
                        Wallet
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td
                          className="p-8 text-center text-muted-foreground"
                          colSpan={7}
                        >
                          {search.trim() || tierFilter
                            ? "No members match your filters."
                            : "No members with active stakes yet."}
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((member) => {
                        const tierConfig = getTierConfig(member.tier);
                        const TierIcon = tierConfig?.icon ?? Shield;
                        return (
                          <tr
                            className={`
                              border-b
                              last:border-0
                            `}
                            key={member.id}
                          >
                            <td className="p-4">
                              {tierConfig ? (
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
                                      className={cn(
                                        "h-4 w-4",
                                        tierConfig.accent,
                                      )}
                                    />
                                  </div>
                                  <span className="font-medium">
                                    {tierConfig.name}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-4 text-muted-foreground">
                              {formatDate(member.memberSince)}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`
                                    relative flex h-9 w-9 shrink-0
                                    overflow-hidden rounded-full border bg-muted
                                  `}
                                >
                                  {member.image ? (
                                    <Image
                                      alt=""
                                      className="object-cover"
                                      fill
                                      sizes="36px"
                                      src={member.image}
                                    />
                                  ) : (
                                    <span
                                      aria-hidden
                                      className={`
                                        flex size-full items-center
                                        justify-center text-xs font-medium
                                        text-muted-foreground
                                      `}
                                    >
                                      {member.name
                                        .trim()
                                        .slice(0, 1)
                                        .toUpperCase() || "?"}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <Link
                                    className={`
                                      block truncate font-medium text-primary
                                      underline-offset-2
                                      hover:underline
                                    `}
                                    href={`/customers/${member.id}`}
                                  >
                                    {member.name}
                                  </Link>
                                  <span
                                    className={`
                                    block truncate text-xs text-muted-foreground
                                  `}
                                  >
                                    {member.email}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-right tabular-nums">
                              {member.orderCount}
                            </td>
                            <td className="p-4 text-right tabular-nums">
                              {formatStakedBalance(
                                member.stakedBalance,
                                data.tokenSymbol,
                              )}
                            </td>
                            <td className="p-4">
                              {member.lock ? (
                                <div className="flex flex-col">
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      member.lock.isLocked
                                        ? `
                                          text-amber-600
                                          dark:text-amber-400
                                        `
                                        : `
                                          text-green-600
                                          dark:text-green-400
                                        `,
                                    )}
                                  >
                                    {member.lock.isLocked
                                      ? "Locked"
                                      : "Unlocked"}
                                  </span>
                                  <span
                                    className={`
                                    text-xs text-muted-foreground
                                  `}
                                  >
                                    {member.lock.durationLabel}
                                    {member.lock.isLocked &&
                                      ` · ${formatDate(member.lock.unlocksAt)}`}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-4">
                              {member.walletAddress ? (
                                <a
                                  className={`
                                    inline-flex items-center gap-1 font-mono
                                    text-xs text-muted-foreground
                                    hover:text-foreground
                                  `}
                                  href={`https://solscan.io/account/${member.walletAddress}`}
                                  rel="noopener noreferrer"
                                  target="_blank"
                                >
                                  {truncateWallet(member.walletAddress)}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
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
                  <span className="flex items-center gap-1">
                    {Array.from(
                      { length: Math.min(5, data.totalPages) },
                      (_, i) => {
                        const start = Math.max(
                          1,
                          Math.min(data.page - 2, data.totalPages - 4),
                        );
                        const pageNum = Math.min(start + i, data.totalPages);
                        const isCurrent = pageNum === data.page;
                        return (
                          <button
                            aria-current={isCurrent ? "page" : undefined}
                            aria-label={`Page ${pageNum}`}
                            className={cn(
                              `
                                flex h-8 w-8 items-center justify-center
                                rounded-full text-sm font-medium
                                transition-colors
                              `,
                              isCurrent
                                ? "bg-primary text-primary-foreground"
                                : `
                                  text-muted-foreground
                                  hover:bg-muted
                                `,
                            )}
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            type="button"
                          >
                            {pageNum}
                          </button>
                        );
                      },
                    )}
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

function formatStakedBalance(balance: string, symbol: string): string {
  const num = Number.parseFloat(balance);
  if (num === 0) return "—";
  return `${num.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${symbol}`;
}

function getTierConfig(tier: null | number) {
  if (tier === null) return null;
  return (
    TIER_CONFIG[tier] ?? {
      accent: "text-muted-foreground",
      bg: "bg-muted",
      icon: Shield,
      name: `Tier ${tier}`,
    }
  );
}

function truncateWallet(address: null | string): string {
  if (!address) return "—";
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
