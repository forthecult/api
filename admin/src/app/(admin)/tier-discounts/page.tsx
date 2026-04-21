"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

type SortBy = "createdAt" | "discountValue" | "memberTier" | "scope";
type SortOrder = "asc" | "desc";

interface TierDiscountRow {
  appliesToEsim: null | number;
  categoryId: null | string;
  createdAt: string;
  discountType: string;
  discountValue: number;
  id: string;
  label: null | string;
  memberTier: number;
  productId: null | string;
  scope: string;
  updatedAt: string;
}

const SCOPE_LABELS: Record<string, string> = {
  category: "Category",
  order: "Order",
  product: "Product / eSIM",
  shipping: "Shipping",
};

interface ListResponse {
  items: TierDiscountRow[];
}

export default function AdminTierDiscountsPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
  const [deletingId, setDeletingId] = useState<null | string>(null);
  const [sortBy, setSortBy] = useState<SortBy>("memberTier");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sortBy, sortOrder });
      const res = await fetch(
        `${API_BASE}/api/admin/tier-discounts?${params}`,
        {
          credentials: "include",
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ListResponse;
      setData(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load tier discounts",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortOrder]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const handleSort = useCallback(
    (column: SortBy) => {
      setSortBy(column);
      setSortOrder((prev) =>
        column !== sortBy
          ? column === "memberTier"
            ? "asc"
            : "desc"
          : prev === "asc"
            ? "desc"
            : "asc",
      );
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
    async (id: string) => {
      if (!window.confirm("Delete this tier discount? This cannot be undone."))
        return;
      setDeletingId(id);
      try {
        const res = await fetch(`${API_BASE}/api/admin/tier-discounts/${id}`, {
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
            ? { ...prev, items: prev.items.filter((r) => r.id !== id) }
            : null,
        );
      } catch {
        void fetchList();
      } finally {
        setDeletingId(null);
      }
    },
    [fetchList],
  );

  const formatDiscount = (row: TierDiscountRow) =>
    row.discountType === "percent"
      ? `${row.discountValue}%`
      : `$${(row.discountValue / 100).toFixed(2)}`;

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
        <h2 className="text-2xl font-semibold tracking-tight">
          Member tier discounts
        </h2>
        <Link href="/tier-discounts/create">
          <Button className="gap-2" type="button">
            <Plus className="size-4" />
            Add tier discount
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="sr-only">Tier discounts</CardTitle>
          <p className="text-sm text-muted-foreground">
            Discounts that apply by CULT member tier (1–3). Multiple discounts
            per tier stack (e.g. 20% off shipping + 15% off eSIMs for BASE).
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
              <p>No tier discounts yet.</p>
              <Link href="/tier-discounts/create">
                <Button className="gap-2" type="button" variant="outline">
                  <Plus className="size-4" />
                  Add tier discount
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
                    <SortHeader column="memberTier" label="Tier" />
                    <th className="p-4 font-medium whitespace-nowrap">Label</th>
                    <th className="p-4 font-medium whitespace-nowrap">Scope</th>
                    <SortHeader column="discountValue" label="Value" />
                    <th className="p-4 font-medium whitespace-nowrap">
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
                      <td className="p-4 font-medium">Tier {row.memberTier}</td>
                      <td
                        className={`
                          max-w-[200px] truncate p-4 text-muted-foreground
                        `}
                        title={row.label ?? ""}
                      >
                        {row.label || "—"}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {SCOPE_LABELS[row.scope] ?? row.scope}
                        {row.appliesToEsim === 1 ? " (eSIM)" : ""}
                      </td>
                      <td className="p-4">{formatDiscount(row)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Link
                            className={`
                              rounded p-1.5 text-muted-foreground
                              transition-colors
                              hover:bg-muted hover:text-foreground
                            `}
                            href={`/tier-discounts/${row.id}`}
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
                            onClick={() => handleDelete(row.id)}
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
