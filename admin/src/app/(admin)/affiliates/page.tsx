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
  applicationNote: null | string;
  code: string;
  commissionType: string;
  commissionValue: number;
  conversionCount: number;
  createdAt: string;
  id: string;
  status: string;
  totalEarnedCents: number;
  totalPaidCents: number;
  userEmail: null | string;
  userId: null | string;
  userName: null | string;
}

interface AffiliatesResponse {
  items: AffiliateRow[];
  limit: number;
  page: number;
  totalCount: number;
  totalPages: number;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
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
  approved:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  suspended:
    "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200",
};

export default function AdminAffiliatesPage() {
  const [data, setData] = useState<AffiliatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const fetchAffiliates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "20", page: String(page) });
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
      <div
        className={`
          rounded-lg border border-red-200 bg-red-50 p-4 text-red-800
          dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
        `}
      >
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
        <CardHeader
          className={`
            flex flex-col gap-4
            sm:flex-row sm:items-center sm:justify-between
          `}
        >
          <CardTitle className="sr-only">Affiliate list</CardTitle>
          <div className="relative max-w-md flex-1">
            <Search
              className={`
                absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2
                text-muted-foreground
              `}
            />
            <input
              aria-label="Search affiliates"
              className={cn(
                `
                  w-full rounded-md border border-input bg-background py-2 pr-3
                  pl-9 text-sm
                `,
                `
                  placeholder:text-muted-foreground
                  focus:ring-2 focus:ring-ring focus:outline-none
                `,
              )}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setSearch(searchInput);
                  setPage(1);
                }
              }}
              placeholder="Search by code, email, name..."
              type="search"
              value={searchInput}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by status"
              className={cn(
                "rounded-md border border-input bg-background px-3 py-2 text-sm",
                "focus:ring-2 focus:ring-ring focus:outline-none",
              )}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              value={statusFilter}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
            <Button
              onClick={() => {
                setSearch(searchInput);
                setPage(1);
              }}
              type="button"
              variant="secondary"
            >
              Search
            </Button>
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
          ) : data ? (
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
                        Code
                      </th>
                      <th className="p-4 font-medium whitespace-nowrap">
                        Status
                      </th>
                      <th className="p-4 font-medium whitespace-nowrap">
                        User
                      </th>
                      <th
                        className={`
                          p-4 text-right font-medium whitespace-nowrap
                        `}
                      >
                        Conversions
                      </th>
                      <th
                        className={`
                          p-4 text-right font-medium whitespace-nowrap
                        `}
                      >
                        Earned
                      </th>
                      <th
                        className={`
                          p-4 text-right font-medium whitespace-nowrap
                        `}
                      >
                        Paid
                      </th>
                      <th className="p-4 font-medium whitespace-nowrap">
                        Applied
                      </th>
                      <th
                        className={`
                          p-4 text-right font-medium whitespace-nowrap
                        `}
                      >
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.length === 0 ? (
                      <tr>
                        <td
                          className="p-8 text-center text-muted-foreground"
                          colSpan={8}
                        >
                          No affiliates found.
                        </td>
                      </tr>
                    ) : (
                      data.items.map((row) => (
                        <tr
                          className={`
                            border-b border-border
                            hover:bg-muted/30
                          `}
                          key={row.id}
                        >
                          <td
                            className={`
                              p-4 font-mono font-medium whitespace-nowrap
                            `}
                          >
                            {row.code}
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span
                              className={cn(
                                `
                                  inline-flex rounded-full px-2.5 py-0.5 text-xs
                                  font-medium
                                `,
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
                                className={`
                                  font-medium text-primary underline-offset-4
                                  hover:underline
                                `}
                                href={`/customers/${row.userId}`}
                              >
                                {row.userName ?? row.userEmail ?? "—"}
                                {row.userEmail && row.userName && (
                                  <span
                                    className={`
                                      block text-xs font-normal
                                      text-muted-foreground
                                    `}
                                  >
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
                                  <span
                                    className={`
                                      block text-xs text-muted-foreground
                                    `}
                                  >
                                    {row.userEmail}
                                  </span>
                                )}
                              </>
                            )}
                          </td>
                          <td
                            className={`
                              p-4 text-right whitespace-nowrap tabular-nums
                            `}
                          >
                            {row.conversionCount}
                          </td>
                          <td
                            className={`
                              p-4 text-right whitespace-nowrap tabular-nums
                            `}
                          >
                            {formatCents(row.totalEarnedCents)}
                          </td>
                          <td
                            className={`
                              p-4 text-right whitespace-nowrap tabular-nums
                            `}
                          >
                            {formatCents(row.totalPaidCents)}
                          </td>
                          <td
                            className={`
                              p-4 whitespace-nowrap text-muted-foreground
                            `}
                          >
                            {formatDate(row.createdAt)}
                          </td>
                          <td className="p-4 text-right whitespace-nowrap">
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
                      disabled={data.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      disabled={data.page >= data.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      size="sm"
                      type="button"
                      variant="outline"
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
