"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

type SortBy =
  | "code"
  | "dateStart"
  | "dateEnd"
  | "discountValue"
  | "uses"
  | "createdAt";
type SortOrder = "asc" | "desc";

type DiscountKind =
  | "amount_off_products"
  | "amount_off_order"
  | "buy_x_get_y"
  | "free_shipping";

type CouponRow = {
  id: string;
  label: string | null;
  method: "automatic" | "code";
  code: string;
  dateStart: string | null;
  dateEnd: string | null;
  discountKind: DiscountKind;
  discountType: "percent" | "fixed";
  discountValue: number;
  appliesTo: string;
  buyQuantity: number | null;
  getQuantity: number | null;
  getDiscountType: string | null;
  getDiscountValue: number | null;
  maxUses: number | null;
  maxUsesPerCustomer: number | null;
  maxUsesPerCustomerType: string | null;
  redemptionCount: number;
  createdAt: string;
  updatedAt: string;
};

const DISCOUNT_KIND_LABELS: Record<DiscountKind, string> = {
  amount_off_products: "Amount of products",
  amount_off_order: "Amount of subtotal",
  buy_x_get_y: "Buy X, get Y",
  free_shipping: "Shipping discount",
};

type ListResponse = { items: CouponRow[] };

function formatDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "short",
    }).format(new Date(s));
  } catch {
    return "—";
  }
}

function formatDiscount(row: CouponRow): string {
  if (row.discountType === "percent") {
    return `${row.discountValue}%`;
  }
  return `$${(row.discountValue / 100).toFixed(2)}`;
}

export default function AdminCouponsPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sortBy, sortOrder });
      const res = await fetch(`${API_BASE}/api/admin/coupons?${params}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ListResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load discounts");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortOrder]);

  useEffect(() => {
    void fetchCoupons();
  }, [fetchCoupons]);

  const handleSort = useCallback(
    (column: SortBy) => {
      setSortBy(column);
      setSortOrder((prev) => {
        if (column !== sortBy) {
          return column === "code" ? "asc" : "desc";
        }
        return prev === "asc" ? "desc" : "asc";
      });
    },
    [sortBy],
  );

  const SortHeader = ({
    column,
    label,
  }: {
    column: SortBy;
    label: string;
  }) => (
    <th className="whitespace-nowrap p-4 font-medium" scope="col">
      <button
        type="button"
        onClick={() => handleSort(column)}
        className="flex items-center gap-1 text-left hover:text-foreground"
      >
        {label}
        {sortBy === column ? (
          sortOrder === "asc" ? (
            <ArrowUp className="size-3.5" aria-hidden />
          ) : (
            <ArrowDown className="size-3.5" aria-hidden />
          )
        ) : null}
      </button>
    </th>
  );

  const handleDelete = useCallback(
    async (id: string, code: string) => {
      if (
        !window.confirm(`Delete discount "${code}"? This cannot be undone.`)
      ) {
        return;
      }
      setDeletingId(id);
      try {
        const res = await fetch(`${API_BASE}/api/admin/coupons/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Failed to delete");
        }
        setData((prev) =>
          prev
            ? { ...prev, items: prev.items.filter((c) => c.id !== id) }
            : null,
        );
      } catch {
        void fetchCoupons();
      } finally {
        setDeletingId(null);
      }
    },
    [fetchCoupons],
  );

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
        {error}
        <Button
          className="mt-2"
          onClick={() => void fetchCoupons()}
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
        <h2 className="text-2xl font-semibold tracking-tight">Discounts</h2>
        <Link href="/coupons/create">
          <Button type="button" className="gap-2">
            <Plus className="size-4" />
            Add discount
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="sr-only">Discounts</CardTitle>
          <p className="text-sm text-muted-foreground">
            Automatic or code-based discounts: amount off products, amount off
            order, buy X get Y, or free shipping.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
              Loading…
            </div>
          ) : data?.items.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
              <p>No discounts yet.</p>
              <Link href="/coupons/create">
                <Button type="button" variant="outline" className="gap-2">
                  <Plus className="size-4" />
                  Add discount
                </Button>
              </Link>
            </div>
          ) : data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th
                      className="whitespace-nowrap p-4 font-medium"
                      scope="col"
                    >
                      Method
                    </th>
                    <th
                      className="whitespace-nowrap p-4 font-medium"
                      scope="col"
                    >
                      Label
                    </th>
                    <SortHeader column="code" label="Code" />
                    <th
                      className="whitespace-nowrap p-4 font-medium"
                      scope="col"
                    >
                      Type
                    </th>
                    <SortHeader column="dateStart" label="Date start" />
                    <SortHeader column="dateEnd" label="Date end" />
                    <SortHeader column="discountValue" label="Value" />
                    <SortHeader column="uses" label="Uses" />
                    <th
                      className="whitespace-nowrap p-4 font-medium"
                      scope="col"
                    >
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b transition-colors hover:bg-muted/30"
                    >
                      <td className="p-4 capitalize">{row.method}</td>
                      <td className="max-w-[200px] truncate p-4 text-muted-foreground" title={row.label ?? ""}>
                        {row.label || "—"}
                      </td>
                      <td className="p-4 font-medium">
                        <Link
                          href={`/coupons/${row.id}`}
                          className="text-primary hover:underline"
                        >
                          {row.method === "automatic" ? "—" : row.code}
                        </Link>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {DISCOUNT_KIND_LABELS[row.discountKind]}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {formatDate(row.dateStart)}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {formatDate(row.dateEnd)}
                      </td>
                      <td className="p-4">{formatDiscount(row)}</td>
                      <td className="p-4 text-muted-foreground">
                        {row.redemptionCount}
                        {row.maxUses != null ? ` / ${row.maxUses}` : ""}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/coupons/${row.id}`}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </Link>
                          <button
                            type="button"
                            disabled={deletingId === row.id}
                            onClick={() => handleDelete(row.id, row.code)}
                            className={cn(
                              "rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive",
                              deletingId === row.id && "opacity-50",
                            )}
                            title="Delete"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
