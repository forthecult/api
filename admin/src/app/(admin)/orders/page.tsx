"use client";

import { ChevronLeft, ChevronRight, Eye, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE =
  typeof process.env.NEXT_PUBLIC_MAIN_APP_URL === "string"
    ? process.env.NEXT_PUBLIC_MAIN_APP_URL
    : "http://localhost:3000";

interface OrderRow {
  id: string;
  userId?: string;
  createdAt: string;
  date: string;
  email: string;
  customer: string;
  channel: string;
  totalCents: number;
  total: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  status: string;
  itemCount: number;
  items: Array<{
    id: string;
    name: string;
    priceCents: number;
    quantity: number;
  }>;
  tags: string[];
}

interface OrdersResponse {
  items: OrderRow[];
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: string): string {
  const normalized = status.toLowerCase().replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const styles =
    normalized === "pending"
      ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
      : normalized === "paid"
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
        : normalized === "refunded" || normalized === "cancelled"
          ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
          : normalized === "fulfilled"
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
            : normalized === "unfulfilled"
              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
              : normalized === "on_hold"
                ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                : normalized === "partially_fulfilled"
                  ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

const COLUMNS = [
  { key: "orderId", label: "Order ID" },
  { key: "date", label: "Date" },
  { key: "customer", label: "Customer" },
  { key: "channel", label: "Channel" },
  { key: "total", label: "Total" },
  { key: "paymentStatus", label: "Payment status" },
  { key: "fulfillmentStatus", label: "Fulfillment status" },
  { key: "items", label: "Items" },
  { key: "tags", label: "Tags" },
  { key: "action", label: "Action" },
] as const;

const SORT_OPTIONS = [
  { value: "date", label: "Date" },
  { value: "customer", label: "Customer" },
  { value: "total", label: "Total" },
  { value: "items", label: "Items" },
] as const;

const PAYMENT_OPTIONS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "refunded", label: "Refunded" },
  { value: "cancelled", label: "Cancelled" },
];

const FULFILLMENT_OPTIONS = [
  { value: "", label: "All" },
  { value: "unfulfilled", label: "Unfulfilled" },
  { value: "on_hold", label: "On hold" },
  { value: "partially_fulfilled", label: "Partially fulfilled" },
  { value: "fulfilled", label: "Fulfilled" },
];

export default function AdminOrdersPage() {
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState<string>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        sortBy: sortBy || "date",
        sortOrder,
      });
      if (search.trim()) params.set("search", search.trim());
      if (paymentFilter) params.set("paymentStatus", paymentFilter);
      if (fulfillmentFilter) params.set("fulfillmentStatus", fulfillmentFilter);
      const res = await fetch(
        `${API_BASE}/api/admin/orders?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as OrdersResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, sortOrder, paymentFilter, fulfillmentFilter]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
        {error}
        <Button
          className="mt-2"
          onClick={() => void fetchOrders()}
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
        <h2 className="text-2xl font-semibold tracking-tight">Orders</h2>
        <Link
          className={cn(
            "inline-flex items-center gap-2 rounded-md border border-transparent",
            "bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
            "transition-colors hover:bg-primary/90",
          )}
          href="/orders/create"
        >
          <Plus className="h-4 w-4" />+ Create Order
        </Link>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Order list</CardTitle>
            <div className="flex w-full max-w-md gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className={cn(
                    "w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm",
                    "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                  )}
                  placeholder="Search Order..."
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
                />
              </div>
              <Button
                type="button"
                onClick={() => {
                  setSearch(searchInput);
                  setPage(1);
                }}
              >
                Search
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Sort:
              </span>
              <select
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                aria-label="Sort by"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value as "asc" | "desc");
                  setPage(1);
                }}
                aria-label="Sort order"
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Payment:
              </span>
              <select
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={paymentFilter}
                onChange={(e) => {
                  setPaymentFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by payment status"
              >
                {PAYMENT_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Fulfillment:
              </span>
              <select
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={fulfillmentFilter}
                onChange={(e) => {
                  setFulfillmentFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by fulfillment status"
              >
                {FULFILLMENT_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Search by Order ID, customer name (first or last), email, or product
            name.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
              Loading…
            </div>
          ) : data && data.items.length > 0 ? (
            <>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          className={cn(
                            "whitespace-nowrap p-4 font-medium",
                            col.key === "amount" && "text-right",
                            col.key === "action" && "text-right",
                          )}
                          scope="col"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((order) => (
                      <tr key={order.id} className="border-b last:border-0">
                        <td className="p-4 font-mono text-xs">
                          <Link
                            href={`/orders/${order.id}`}
                            className="text-primary hover:underline"
                          >
                            #{order.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="p-4">
                          {formatDate(order.date ?? order.createdAt)}
                        </td>
                        <td className="p-4">
                          {order.userId ? (
                            <Link
                              href={`/customers/${order.userId}`}
                              className="text-primary hover:underline"
                            >
                              {order.customer ?? order.email ?? "—"}
                            </Link>
                          ) : (
                            (order.customer ?? order.email ?? "—")
                          )}
                        </td>
                        <td className="p-4">{order.channel ?? "—"}</td>
                        <td className="p-4 text-right tabular-nums">
                          {formatCents(order.totalCents ?? order.total ?? 0)}
                        </td>
                        <td className="p-4">
                          <StatusPill
                            status={order.paymentStatus ?? order.status}
                          />
                        </td>
                        <td className="p-4">
                          <StatusPill
                            status={order.fulfillmentStatus ?? order.status}
                          />
                        </td>
                        <td className="p-4 text-right tabular-nums">
                          {order.itemCount ??
                            order.items?.reduce((s, i) => s + i.quantity, 0) ??
                            0}
                        </td>
                        <td className="p-4">
                          {order.tags?.length ? order.tags.join(", ") : "—"}
                        </td>
                        <td className="p-4 text-right">
                          <span className="inline-flex items-center gap-1">
                            <Link
                              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              href={`/orders/${order.id}`}
                              aria-label="View order"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 border-t pt-4">
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
                <span className="flex items-center gap-1">
                  {(() => {
                    const total = data.totalPages;
                    const windowSize = Math.min(5, total);
                    const start = Math.max(
                      1,
                      Math.min(data.page - 2, total - windowSize),
                    );
                    return Array.from({ length: windowSize }, (_, i) => {
                      const pageNum = start + i;
                      const isCurrent = pageNum === data.page;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setPage(pageNum)}
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                            isCurrent
                              ? "bg-primary text-primary-foreground"
                              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                          )}
                          aria-label={`Page ${pageNum}`}
                          aria-current={isCurrent ? "page" : undefined}
                        >
                          {pageNum}
                        </button>
                      );
                    });
                  })()}
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
            </>
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              {search.trim()
                ? "No orders match your search."
                : "No orders yet."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
