"use client";

import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

interface RefundRow {
  id: string;
  orderId: string;
  status: string;
  refundAddress: string | null;
  createdAt: string;
  updatedAt: string;
  order: {
    email: string;
    totalCents: number;
    paymentStatus: string | null;
    paymentMethod: string | null;
  };
}

interface RefundsResponse {
  items: RefundRow[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

function formatDate(s: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(s));
  } catch {
    return "—";
  }
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "requested", label: "Requested" },
  { value: "approved", label: "Approved" },
  { value: "refunded", label: "Refunded" },
  { value: "rejected", label: "Rejected" },
] as const;

const NEXT_STATUS_OPTIONS: Record<
  string,
  Array<{ value: string; label: string }>
> = {
  requested: [
    { value: "approved", label: "Approve" },
    { value: "refunded", label: "Mark refunded" },
    { value: "rejected", label: "Reject" },
  ],
  approved: [
    { value: "refunded", label: "Mark refunded" },
    { value: "rejected", label: "Reject" },
  ],
  refunded: [],
  rejected: [],
};

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const styles =
    normalized === "requested"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
      : normalized === "approved"
        ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
        : normalized === "refunded"
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
          : normalized === "rejected"
            ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
            : "bg-muted text-muted-foreground";
  const label = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles,
      )}
    >
      {label}
    </span>
  );
}

export default function AdminRefundsPage() {
  const [data, setData] = useState<RefundsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [orderIdSearch, setOrderIdSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchRefunds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (statusFilter.trim()) params.set("status", statusFilter.trim());
      if (orderIdSearch.trim()) params.set("orderId", orderIdSearch.trim());
      const res = await fetch(
        `${API_BASE}/api/admin/refunds?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as RefundsResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load refunds");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, orderIdSearch]);

  useEffect(() => {
    void fetchRefunds();
  }, [fetchRefunds]);

  const updateStatus = useCallback(
    async (id: string, status: string) => {
      setUpdatingId(id);
      try {
        const res = await fetch(`${API_BASE}/api/admin/refunds/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        await fetchRefunds();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update status",
        );
      } finally {
        setUpdatingId(null);
      }
    },
    [fetchRefunds],
  );

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
        {error}
        <Button
          className="mt-2"
          onClick={() => void fetchRefunds()}
          type="button"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-7 w-7" />
          <h2 className="text-2xl font-semibold tracking-tight">
            Refund requests
          </h2>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="sr-only">Refund request list</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="statusFilter" className="text-sm font-medium">
              Status
            </label>
            <select
              id="statusFilter"
              className={cn(
                "rounded-md border border-input bg-background px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring",
              )}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by refund status"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <label htmlFor="orderIdSearch" className="text-sm font-medium">
              Order ID
            </label>
            <input
              id="orderIdSearch"
              type="text"
              placeholder="Filter by order ID"
              className={cn(
                "rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[180px]",
                "focus:outline-none focus:ring-2 focus:ring-ring",
              )}
              value={orderIdSearch}
              onChange={(e) => setOrderIdSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setPage(1);
                  void fetchRefunds();
                }
              }}
              aria-label="Filter by order ID"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchRefunds()}
              disabled={loading}
              aria-label="Refresh list"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
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
                      <th
                        scope="col"
                        className="whitespace-nowrap p-4 font-medium"
                      >
                        Request date
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap p-4 font-medium"
                      >
                        Order
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap p-4 font-medium"
                      >
                        Customer
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap p-4 font-medium"
                      >
                        Amount
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap p-4 font-medium"
                      >
                        Refund status
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap p-4 font-medium"
                      >
                        Crypto address
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap p-4 font-medium text-right"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.length === 0 ? (
                      <tr>
                        <td
                          className="p-8 text-center text-muted-foreground"
                          colSpan={7}
                        >
                          {statusFilter || orderIdSearch
                            ? "No refund requests match the filters."
                            : "No refund requests yet."}
                        </td>
                      </tr>
                    ) : (
                      data.items.map((row) => {
                        const nextOptions =
                          NEXT_STATUS_OPTIONS[row.status] ?? [];
                        return (
                          <tr
                            key={row.id}
                            className="border-b border-border last:border-0 hover:bg-muted/30"
                          >
                            <td className="whitespace-nowrap p-4 text-muted-foreground">
                              {formatDate(row.createdAt)}
                            </td>
                            <td className="p-4">
                              <Link
                                href={`/orders/${row.orderId}`}
                                className="inline-flex items-center gap-1 font-mono text-xs text-primary underline-offset-2 hover:underline"
                              >
                                {row.orderId.slice(0, 12)}…
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </td>
                            <td className="p-4">
                              <span className="text-muted-foreground">
                                {row.order.email}
                              </span>
                            </td>
                            <td className="whitespace-nowrap p-4 font-medium">
                              {formatCents(row.order.totalCents)}
                            </td>
                            <td className="p-4">
                              <StatusPill status={row.status} />
                              {row.order.paymentStatus && (
                                <span className="ml-1.5 text-xs text-muted-foreground">
                                  (order: {row.order.paymentStatus})
                                </span>
                              )}
                            </td>
                            <td
                              className="max-w-[180px] truncate p-4 font-mono text-xs text-muted-foreground"
                              title={row.refundAddress ?? undefined}
                            >
                              {row.refundAddress ?? "—"}
                            </td>
                            <td className="p-4 text-right">
                              {nextOptions.length > 0 ? (
                                <span className="inline-flex flex-wrap gap-1">
                                  {nextOptions.map((opt) => (
                                    <Button
                                      key={opt.value}
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      disabled={updatingId === row.id}
                                      onClick={() =>
                                        updateStatus(row.id, opt.value)
                                      }
                                    >
                                      {updatingId === row.id ? "…" : opt.label}
                                    </Button>
                                  ))}
                                </span>
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

              {data.items.length > 0 && data.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2 border-t border-border pt-4">
                  <Button
                    disabled={data.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    size="sm"
                    type="button"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {data.page} of {data.totalPages} ({data.totalCount}{" "}
                    total)
                  </span>
                  <Button
                    disabled={data.page >= data.totalPages}
                    onClick={() =>
                      setPage((p) => Math.min(data.totalPages, p + 1))
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    aria-label="Next page"
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
