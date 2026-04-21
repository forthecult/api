"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

interface CouponRow {
  appliesTo: string;
  buyQuantity: null | number;
  code: string;
  createdAt: string;
  dateEnd: null | string;
  dateStart: null | string;
  discountKind: DiscountKind;
  discountType: "fixed" | "percent";
  discountValue: number;
  getDiscountType: null | string;
  getDiscountValue: null | number;
  getQuantity: null | number;
  id: string;
  label: null | string;
  maxUses: null | number;
  maxUsesPerCustomer: null | number;
  maxUsesPerCustomerType: null | string;
  method: "automatic" | "code";
  redemptionCount: number;
  updatedAt: string;
}
type DiscountKind =
  | "amount_off_order"
  | "amount_off_products"
  | "buy_x_get_y"
  | "free_shipping";

type SortBy =
  | "code"
  | "createdAt"
  | "dateEnd"
  | "dateStart"
  | "discountValue"
  | "uses";

type SortOrder = "asc" | "desc";

const DISCOUNT_KIND_LABELS: Record<DiscountKind, string> = {
  amount_off_order: "Amount of subtotal",
  amount_off_products: "Amount of products",
  buy_x_get_y: "Buy X, get Y",
  free_shipping: "Shipping discount",
};

interface ListResponse {
  items: CouponRow[];
}

export default function AdminCouponsPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
  const [deletingId, setDeletingId] = useState<null | string>(null);
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

  const SortHeader = ({ column, label }: { column: SortBy; label: string }) => (
    <th className="p-4 font-medium whitespace-nowrap" scope="col">
      <button
        className={`
          flex items-center gap-1 text-left
          hover:text-foreground
        `}
        onClick={() => handleSort(column)}
        type="button"
      >
        {label}
        {sortBy === column ? (
          sortOrder === "asc" ? (
            <ArrowUp aria-hidden className="size-3.5" />
          ) : (
            <ArrowDown aria-hidden className="size-3.5" />
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
          credentials: "include",
          method: "DELETE",
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
      <div
        className={`
          rounded-lg border border-red-200 bg-red-50 p-4 text-red-800
          dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
        `}
      >
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
      <div
        className={`
          flex flex-col gap-4
          sm:flex-row sm:items-center sm:justify-between
        `}
      >
        <h2 className="text-2xl font-semibold tracking-tight">Discounts</h2>
        <Link href="/coupons/create">
          <Button className="gap-2" type="button">
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
            <div
              className={`
                flex min-h-[200px] items-center justify-center
                text-muted-foreground
              `}
            >
              Loading…
            </div>
          ) : data?.items.length === 0 ? (
            <div
              className={`
                flex min-h-[200px] flex-col items-center justify-center gap-2
                p-8 text-muted-foreground
              `}
            >
              <p>No discounts yet.</p>
              <Link href="/coupons/create">
                <Button className="gap-2" type="button" variant="outline">
                  <Plus className="size-4" />
                  Add discount
                </Button>
              </Link>
            </div>
          ) : data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className={`
                      border-b bg-muted/50 text-left text-xs font-semibold
                      tracking-wider text-muted-foreground uppercase
                    `}
                  >
                    <th
                      className="p-4 font-medium whitespace-nowrap"
                      scope="col"
                    >
                      Method
                    </th>
                    <th
                      className="p-4 font-medium whitespace-nowrap"
                      scope="col"
                    >
                      Label
                    </th>
                    <SortHeader column="code" label="Code" />
                    <th
                      className="p-4 font-medium whitespace-nowrap"
                      scope="col"
                    >
                      Type
                    </th>
                    <SortHeader column="dateStart" label="Date start" />
                    <SortHeader column="dateEnd" label="Date end" />
                    <SortHeader column="discountValue" label="Value" />
                    <SortHeader column="uses" label="Uses" />
                    <th
                      className="p-4 font-medium whitespace-nowrap"
                      scope="col"
                    >
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr
                      className={`
                        border-b transition-colors
                        hover:bg-muted/30
                      `}
                      key={row.id}
                    >
                      <td className="p-4 capitalize">{row.method}</td>
                      <td
                        className={`
                          max-w-[200px] truncate p-4 text-muted-foreground
                        `}
                        title={row.label ?? ""}
                      >
                        {row.label || "—"}
                      </td>
                      <td className="p-4 font-medium">
                        <Link
                          className={`
                            text-primary
                            hover:underline
                          `}
                          href={`/coupons/${row.id}`}
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
                            className={`
                              rounded p-1.5 text-muted-foreground
                              transition-colors
                              hover:bg-muted hover:text-foreground
                            `}
                            href={`/coupons/${row.id}`}
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </Link>
                          <button
                            className={cn(
                              `
                                rounded p-1.5 text-muted-foreground
                                transition-colors
                                hover:bg-destructive/10 hover:text-destructive
                              `,
                              deletingId === row.id && "opacity-50",
                            )}
                            disabled={deletingId === row.id}
                            onClick={() => handleDelete(row.id, row.code)}
                            title="Delete"
                            type="button"
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

function formatDate(s: null | string): string {
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
