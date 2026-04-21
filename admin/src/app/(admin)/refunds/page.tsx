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
  createdAt: string;
  id: string;
  order: {
    email: string;
    paymentMethod: null | string;
    paymentStatus: null | string;
    totalCents: number;
  };
  orderId: string;
  refundAddress: null | string;
  status: string;
  updatedAt: string;
}

interface RefundsResponse {
  items: RefundRow[];
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
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(s));
  } catch {
    return "—";
  }
}

const STATUS_OPTIONS = [
  { label: "All statuses", value: "" },
  { label: "Requested", value: "requested" },
  { label: "Approved", value: "approved" },
  { label: "Refunded", value: "refunded" },
  { label: "Rejected", value: "rejected" },
] as const;

const NEXT_STATUS_OPTIONS: Record<string, { label: string; value: string }[]> =
  {
    approved: [
      { label: "Mark refunded", value: "refunded" },
      { label: "Reject", value: "rejected" },
    ],
    refunded: [],
    rejected: [],
    requested: [
      { label: "Approve", value: "approved" },
      { label: "Mark refunded", value: "refunded" },
      { label: "Reject", value: "rejected" },
    ],
  };

export default function AdminRefundsPage() {
  const [data, setData] = useState<null | RefundsResponse>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [orderIdSearch, setOrderIdSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<null | string>(null);

  const fetchRefunds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: "20",
        page: String(page),
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
          body: JSON.stringify({ status }),
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
      <div
        className={`
          rounded-lg border border-red-200 bg-red-50 p-4 text-red-800
          dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
        `}
      >
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
      <div
        className={`
          flex flex-col gap-4
          sm:flex-row sm:items-center sm:justify-between
        `}
      >
        <div className="flex items-center gap-2">
          <Wallet className="h-7 w-7" />
          <h2 className="text-2xl font-semibold tracking-tight">
            Refund requests
          </h2>
        </div>
      </div>

      <Card>
        <CardHeader
          className={`
            flex flex-col gap-4
            sm:flex-row sm:items-center sm:justify-between
          `}
        >
          <CardTitle className="sr-only">Refund request list</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium" htmlFor="statusFilter">
              Status
            </label>
            <select
              aria-label="Filter by refund status"
              className={cn(
                "rounded-md border border-input bg-background px-3 py-2 text-sm",
                "focus:ring-2 focus:ring-ring focus:outline-none",
              )}
              id="statusFilter"
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              value={statusFilter}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <label className="text-sm font-medium" htmlFor="orderIdSearch">
              Order ID
            </label>
            <input
              aria-label="Filter by order ID"
              className={cn(
                `
                  min-w-[180px] rounded-md border border-input bg-background
                  px-3 py-2 text-sm
                `,
                "focus:ring-2 focus:ring-ring focus:outline-none",
              )}
              id="orderIdSearch"
              onChange={(e) => setOrderIdSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setPage(1);
                  void fetchRefunds();
                }
              }}
              placeholder="Filter by order ID"
              type="text"
              value={orderIdSearch}
            />
            <Button
              aria-label="Refresh list"
              disabled={loading}
              onClick={() => void fetchRefunds()}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
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
                      <th
                        className="p-4 font-medium whitespace-nowrap"
                        scope="col"
                      >
                        Request date
                      </th>
                      <th
                        className="p-4 font-medium whitespace-nowrap"
                        scope="col"
                      >
                        Order
                      </th>
                      <th
                        className="p-4 font-medium whitespace-nowrap"
                        scope="col"
                      >
                        Customer
                      </th>
                      <th
                        className="p-4 font-medium whitespace-nowrap"
                        scope="col"
                      >
                        Amount
                      </th>
                      <th
                        className="p-4 font-medium whitespace-nowrap"
                        scope="col"
                      >
                        Refund status
                      </th>
                      <th
                        className="p-4 font-medium whitespace-nowrap"
                        scope="col"
                      >
                        Crypto address
                      </th>
                      <th
                        className="p-4 text-right font-medium whitespace-nowrap"
                        scope="col"
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
                            className={`
                              border-b border-border
                              last:border-0
                              hover:bg-muted/30
                            `}
                            key={row.id}
                          >
                            <td
                              className={`
                                p-4 whitespace-nowrap text-muted-foreground
                              `}
                            >
                              {formatDate(row.createdAt)}
                            </td>
                            <td className="p-4">
                              <Link
                                className={`
                                  inline-flex items-center gap-1 font-mono
                                  text-xs text-primary underline-offset-2
                                  hover:underline
                                `}
                                href={`/orders/${row.orderId}`}
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
                            <td className="p-4 font-medium whitespace-nowrap">
                              {formatCents(row.order.totalCents)}
                            </td>
                            <td className="p-4">
                              <StatusPill status={row.status} />
                              {row.order.paymentStatus && (
                                <span
                                  className={`
                                    ml-1.5 text-xs text-muted-foreground
                                  `}
                                >
                                  (order: {row.order.paymentStatus})
                                </span>
                              )}
                            </td>
                            <td
                              className={`
                                max-w-[180px] truncate p-4 font-mono text-xs
                                text-muted-foreground
                              `}
                              title={row.refundAddress ?? undefined}
                            >
                              {row.refundAddress ?? "—"}
                            </td>
                            <td className="p-4 text-right">
                              {nextOptions.length > 0 ? (
                                <span className="inline-flex flex-wrap gap-1">
                                  {nextOptions.map((opt) => (
                                    <Button
                                      className="h-7 text-xs"
                                      disabled={updatingId === row.id}
                                      key={opt.value}
                                      onClick={() =>
                                        updateStatus(row.id, opt.value)
                                      }
                                      size="sm"
                                      type="button"
                                      variant="outline"
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
                <div
                  className={`
                    mt-4 flex items-center justify-center gap-2 border-t
                    border-border pt-4
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
                    Page {data.page} of {data.totalPages} ({data.totalCount}{" "}
                    total)
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

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const styles =
    normalized === "requested"
      ? `
        bg-amber-100 text-amber-800
        dark:bg-amber-900/40 dark:text-amber-200
      `
      : normalized === "approved"
        ? `
          bg-sky-100 text-sky-800
          dark:bg-sky-900/40 dark:text-sky-200
        `
        : normalized === "refunded"
          ? `
            bg-emerald-100 text-emerald-800
            dark:bg-emerald-900/40 dark:text-emerald-200
          `
          : normalized === "rejected"
            ? `
              bg-red-100 text-red-800
              dark:bg-red-900/40 dark:text-red-200
            `
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
