"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

const COUNTRY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All countries" },
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "MX", label: "Mexico" },
  { value: "OTHER", label: "Other (enter code)" },
];

type ShippingOptionRow = {
  id: string;
  name: string;
  countryCode: string | null;
  minOrderCents: number | null;
  maxOrderCents: number | null;
  minQuantity: number | null;
  maxQuantity: number | null;
  minWeightGrams: number | null;
  maxWeightGrams: number | null;
  type: "flat" | "per_item" | "free";
  amountCents: number | null;
  priority: number;
  brandId: string | null;
  brandName: string | null;
  sourceUrl: string | null;
  estimatedDaysText: string | null;
  createdAt: string;
  updatedAt: string;
};

type BrandOption = { id: string; name: string };

type ListResponse = { items: ShippingOptionRow[] };

const SORT_KEYS = [
  "name",
  "countryCode",
  "minOrderCents",
  "minQuantity",
  "minWeightGrams",
  "type",
  "priority",
  "brandName",
] as const;
type SortBy = (typeof SORT_KEYS)[number];

function formatRange(
  min: number | null,
  max: number | null,
  formatter: (n: number) => string,
): string {
  if (min == null && max == null) return "—";
  if (min != null && max == null) return `${formatter(min)}+`;
  if (min == null && max != null) return `≤ ${formatter(max)}`;
  return `${formatter(min)} – ${formatter(max)}`;
}

export default function AdminShippingOptionsPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("priority");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [brandFilter, setBrandFilter] = useState<string>("");

  const fetchOptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sortBy, sortOrder });
      if (brandFilter) params.set("brandId", brandFilter);
      const res = await fetch(
        `${API_BASE}/api/admin/shipping-options?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ListResponse;
      setData(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load shipping options",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortOrder, brandFilter]);

  useEffect(() => {
    void fetchOptions();
  }, [fetchOptions]);

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/brands?limit=500`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((json: { items?: BrandOption[] }) =>
        setBrands(json.items ?? []),
      )
      .catch(() => setBrands([]));
  }, []);

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      if (
        !window.confirm(
          `Delete shipping option "${name}"? This cannot be undone.`,
        )
      ) {
        return;
      }
      setDeletingId(id);
      try {
        const res = await fetch(
          `${API_BASE}/api/admin/shipping-options/${id}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Failed to delete");
        }
        setData((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.filter((o) => o.id !== id),
              }
            : null,
        );
      } catch {
        void fetchOptions();
      } finally {
        setDeletingId(null);
      }
    },
    [fetchOptions],
  );

  const toggleSort = useCallback((key: SortBy) => {
    setSortBy(key);
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  }, []);

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
        onClick={() => toggleSort(column)}
        className="flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        {label}
        {sortBy === column ? (
          sortOrder === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )
        ) : (
          <ArrowUpDown className="size-3.5 opacity-50" />
        )}
      </button>
    </th>
  );

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
        {error}
        <Button
          className="mt-2"
          onClick={() => void fetchOptions()}
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
        <h2 className="text-2xl font-semibold tracking-tight">
          Shipping options
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <Link href="/shipping-options/create">
            <Button type="button" className="gap-2">
              <Plus className="size-4" />
              Add shipping option
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="sr-only">Shipping options</CardTitle>
          <p className="text-sm text-muted-foreground">
            Rules are evaluated by priority (lower number first). Use country,
            order value, quantity, and weight to target specific cases. Free
            shipping rules can override paid rules when the order meets the
            threshold.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
              Loading…
            </div>
          ) : data?.items.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
              <p>No shipping options yet.</p>
              <Link href="/shipping-options/create">
                <Button type="button" variant="outline" className="gap-2">
                  <Plus className="size-4" />
                  Add shipping option
                </Button>
              </Link>
            </div>
          ) : data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <SortHeader column="name" label="Name" />
                    <SortHeader column="brandName" label="Brand" />
                    <SortHeader column="countryCode" label="Country" />
                    <SortHeader column="minOrderCents" label="Order value" />
                    <SortHeader column="minQuantity" label="Quantity" />
                    <SortHeader column="minWeightGrams" label="Weight (g)" />
                    <SortHeader column="type" label="Type" />
                    <th
                      className="whitespace-nowrap p-4 font-medium"
                      scope="col"
                    >
                      Amount
                    </th>
                    <SortHeader column="priority" label="Priority" />
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
                      <td className="p-4 font-medium">
                        <Link
                          href={`/shipping-options/${row.id}`}
                          className="text-primary hover:underline"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="p-4">
                        {row.brandName ?? "—"}
                      </td>
                      <td className="p-4">
                        {row.countryCode
                          ? (COUNTRY_OPTIONS.find(
                              (c) => c.value === row.countryCode,
                            )?.label ?? row.countryCode)
                          : "All"}
                      </td>
                      <td className="p-4">
                        {formatRange(
                          row.minOrderCents,
                          row.maxOrderCents,
                          (c) => `$${(c / 100).toFixed(2)}`,
                        )}
                      </td>
                      <td className="p-4">
                        {formatRange(row.minQuantity, row.maxQuantity, (n) =>
                          String(n),
                        )}
                      </td>
                      <td className="p-4">
                        {formatRange(
                          row.minWeightGrams,
                          row.maxWeightGrams,
                          (n) => `${n} g`,
                        )}
                      </td>
                      <td className="p-4 capitalize">
                        {row.type.replace("_", " ")}
                      </td>
                      <td className="p-4">
                        {row.type === "free"
                          ? "Free"
                          : row.amountCents != null
                            ? row.type === "per_item"
                              ? `$${(row.amountCents / 100).toFixed(2)}/item`
                              : `$${(row.amountCents / 100).toFixed(2)}`
                            : "—"}
                      </td>
                      <td className="p-4">{row.priority}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/shipping-options/${row.id}`}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </Link>
                          <button
                            type="button"
                            disabled={deletingId === row.id}
                            onClick={() => handleDelete(row.id, row.name)}
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
