"use client";

import { ChevronLeft, ChevronRight, Link2, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

interface AffiliateRow {
  id: string;
  userId: string | null;
  code: string;
  status: string;
  commissionType: string;
  commissionValue: number;
  totalEarnedCents: number;
  totalPaidCents: number;
  conversionCount: number;
  userEmail: string | null;
  userName: string | null;
  createdAt: string;
  applicationNote: string | null;
}

interface AffiliatesResponse {
  items: AffiliateRow[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(s: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(s));
  } catch {
    return "—";
  }
}

const STATUS_BADGE: Record<string, string> = {
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  approved:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  suspended:
    "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200",
};

export default function AdminAffiliatesPage() {
  const [data, setData] = useState<AffiliatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const fetchAffiliates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(
        `${API_BASE}/api/admin/affiliates?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as AffiliatesResponse;
      setData(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load affiliates",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    void fetchAffiliates();
  }, [fetchAffiliates]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
        {error}
        <Button
          className="mt-2"
          onClick={() => void fetchAffiliates()}
          type="button"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link2 className="h-7 w-7" />
        <h2 className="text-2xl font-semibold tracking-tight">Affiliates</h2>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="sr-only">Affiliate list</CardTitle>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn(
                "w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm",
                "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
              )}
              placeholder="Search by code, email, name..."
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setSearch(searchInput);
                  setPage(1);
                }
              }}
              aria-label="Search affiliates"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={cn(
                "rounded-md border border-input bg-background px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring",
              )}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSearch(searchInput);
                setPage(1);
              }}
            >
              Search
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
              Loading…
            </div>
          ) : data ? (
            <>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="whitespace-nowrap p-4 font-medium">
                        Code
                      </th>
                      <th className="whitespace-nowrap p-4 font-medium">
                        Status
                      </th>
                      <th className="whitespace-nowrap p-4 font-medium">
                        User
                      </th>
                      <th className="whitespace-nowrap p-4 font-medium text-right">
                        Conversions
                      </th>
                      <th className="whitespace-nowrap p-4 font-medium text-right">
                        Earned
                      </th>
                      <th className="whitespace-nowrap p-4 font-medium text-right">
                        Paid
                      </th>
                      <th className="whitespace-nowrap p-4 font-medium">
                        Applied
                      </th>
                      <th className="whitespace-nowrap p-4 font-medium text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="p-8 text-center text-muted-foreground"
                        >
                          No affiliates found.
                        </td>
                      </tr>
                    ) : (
                      data.items.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-border hover:bg-muted/30"
                        >
                          <td className="whitespace-nowrap p-4 font-mono font-medium">
                            {row.code}
                          </td>
                          <td className="whitespace-nowrap p-4">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                                STATUS_BADGE[row.status] ??
                                  "bg-muted text-muted-foreground",
                              )}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="p-4">
                            {row.userId ? (
                              <Link
                                href={`/customers/${row.userId}`}
                                className="font-medium text-primary underline-offset-4 hover:underline"
                              >
                                {row.userName ?? row.userEmail ?? "—"}
                                {row.userEmail && row.userName && (
                                  <span className="block text-xs font-normal text-muted-foreground">
                                    {row.userEmail}
                                  </span>
                                )}
                              </Link>
                            ) : (
                              <>
                                <span className="font-medium">
                                  {row.userName ?? row.userEmail ?? "—"}
                                </span>
                                {row.userEmail && row.userName && (
                                  <span className="block text-xs text-muted-foreground">
                                    {row.userEmail}
                                  </span>
                                )}
                              </>
                            )}
                          </td>
                          <td className="whitespace-nowrap p-4 text-right tabular-nums">
                            {row.conversionCount}
                          </td>
                          <td className="whitespace-nowrap p-4 text-right tabular-nums">
                            {formatCents(row.totalEarnedCents)}
                          </td>
                          <td className="whitespace-nowrap p-4 text-right tabular-nums">
                            {formatCents(row.totalPaidCents)}
                          </td>
                          <td className="whitespace-nowrap p-4 text-muted-foreground">
                            {formatDate(row.createdAt)}
                          </td>
                          <td className="whitespace-nowrap p-4 text-right">
                            <Button asChild size="sm" variant="ghost">
                              <Link href={`/affiliates/${row.id}`}>Edit</Link>
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {data.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {data.page} of {data.totalPages} ({data.totalCount}{" "}
                    total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={data.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={data.page >= data.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
