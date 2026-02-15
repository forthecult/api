"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

type SortBy = "memberTier" | "scope" | "discountValue" | "createdAt";
type SortOrder = "asc" | "desc";

type TierDiscountRow = {
  id: string;
  memberTier: number;
  label: string | null;
  scope: string;
  discountType: string;
  discountValue: number;
  categoryId: string | null;
  productId: string | null;
  appliesToEsim: number | null;
  createdAt: string;
  updatedAt: string;
};

const SCOPE_LABELS: Record<string, string> = {
  shipping: "Shipping",
  order: "Order",
  category: "Category",
  product: "Product / eSIM",
};

type ListResponse = { items: TierDiscountRow[] };

export default function AdminTierDiscountsPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
    async (id: string) => {
      if (!window.confirm("Delete this tier discount? This cannot be undone."))
        return;
      setDeletingId(id);
      try {
        const res = await fetch(`${API_BASE}/api/admin/tier-discounts/${id}`, {
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
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
        {error}
        <Button className="mt-2" onClick={() => void fetchList()} type="button">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">
          Member tier discounts
        </h2>
        <Link href="/tier-discounts/create">
          <Button type="button" className="gap-2">
            <Plus className="size-4" />
            Add tier discount
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="sr-only">Tier discounts</CardTitle>
          <p className="text-sm text-muted-foreground">
            Discounts that apply by CULT member tier (1–4). Multiple discounts
            per tier stack (e.g. 20% off shipping + 15% off eSIMs for Tier 3).
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
              Loading…
            </div>
          ) : data?.items.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
              <p>No tier discounts yet.</p>
              <Link href="/tier-discounts/create">
                <Button type="button" variant="outline" className="gap-2">
                  <Plus className="size-4" />
                  Add tier discount
                </Button>
              </Link>
            </div>
          ) : data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <SortHeader column="memberTier" label="Tier" />
                    <th className="whitespace-nowrap p-4 font-medium">Label</th>
                    <th className="whitespace-nowrap p-4 font-medium">Scope</th>
                    <SortHeader column="discountValue" label="Value" />
                    <th className="whitespace-nowrap p-4 font-medium">
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
                      <td className="p-4 font-medium">Tier {row.memberTier}</td>
                      <td
                        className="max-w-[200px] truncate p-4 text-muted-foreground"
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
                            href={`/tier-discounts/${row.id}`}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </Link>
                          <button
                            type="button"
                            disabled={deletingId === row.id}
                            onClick={() => handleDelete(row.id)}
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
