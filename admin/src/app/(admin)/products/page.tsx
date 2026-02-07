"use client";

import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpDown,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

type SyncVendor = "printful" | "printify";
type SyncDirection = "from" | "to";

interface SyncState {
  vendor: SyncVendor;
  direction: SyncDirection;
  loading: boolean;
  result?: {
    success: boolean;
    summary?: { imported?: number; updated?: number; skipped?: number; errors?: number };
    errors?: string[];
    error?: string;
  };
}

interface ProductRow {
  id: string;
  name: string;
  slug?: string | null;
  imageUrl: string | null;
  priceCents: number;
  published: boolean;
  brand: string | null;
  categoryName: string | null;
  vendor: string | null;
  inventory: string;
}

interface ProductsResponse {
  items: ProductRow[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const SORTABLE_COLUMNS = [
  "name",
  "category",
  "brand",
  "vendor",
  "price",
  "published",
  "inStock",
] as const;
type SortBy = (typeof SORTABLE_COLUMNS)[number];

const COLUMNS = [
  { key: "name", label: "Name", sortKey: "name" as const },
  { key: "category", label: "Category", sortKey: "category" as const },
  { key: "brand", label: "Brand", sortKey: "brand" as const },
  { key: "price", label: "Price", sortKey: "price" as const },
  { key: "inventory", label: "In stock", sortKey: "inStock" as const },
  { key: "vendor", label: "Vendor", sortKey: "vendor" as const },
  { key: "published", label: "Published", sortKey: "published" as const },
  { key: "action", label: "Action", sortKey: null },
] as const;

export default function AdminProductsPage() {
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        sortBy,
        sortOrder,
      });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(
        `${API_BASE}/api/admin/products?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ProductsResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, sortOrder]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const runSync = useCallback(
    async (vendor: SyncVendor, direction: SyncDirection) => {
      setSyncState({ vendor, direction, loading: true });
      const base = `${API_BASE}/api/admin/${vendor}/sync`;
      try {
        if (direction === "from") {
          // Vendor → Store: mockups, inventory, shipping
          const res = await fetch(base, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              action: "import_all",
              overwrite: true,
            }),
          });
          const json = (await res.json().catch(() => ({}))) as SyncState["result"] & { error?: string };
          if (!res.ok) {
            setSyncState((s) =>
              s ? { ...s, loading: false, result: { success: false, error: json.error ?? "Sync failed" } } : null,
            );
            return;
          }
          setSyncState((s) =>
            s ? { ...s, loading: false, result: { ...json, success: json.success !== false } } : null,
          );
        } else {
          // Store → Vendor: tags, SEO, descriptions, titles (and prices/SKU per backend)
          const res = await fetch(base, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ action: "export_all" }),
          });
          const json = (await res.json().catch(() => ({}))) as SyncState["result"] & { error?: string };
          if (!res.ok) {
            setSyncState((s) =>
              s ? { ...s, loading: false, result: { success: false, error: json.error ?? "Sync failed" } } : null,
            );
            return;
          }
          setSyncState((s) =>
            s ? { ...s, loading: false, result: { ...json, success: json.success !== false } } : null,
          );
        }
        void fetchProducts();
      } catch (err) {
        setSyncState((s) =>
          s
            ? {
                ...s,
                loading: false,
                result: {
                  success: false,
                  error: err instanceof Error ? err.message : "Sync failed",
                },
              }
            : null,
        );
      }
    },
    [fetchProducts],
  );

  const handleTogglePublished = useCallback(
    async (id: string, current: boolean) => {
      setTogglingId(id);
      try {
        const res = await fetch(`${API_BASE}/api/admin/products/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ published: !current }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Failed to update");
        }
        setData((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((p) =>
                  p.id === id ? { ...p, published: !current } : p,
                ),
              }
            : null,
        );
      } catch {
        void fetchProducts();
      } finally {
        setTogglingId(null);
      }
    },
    [fetchProducts],
  );

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
        {error}
        <Button
          className="mt-2"
          onClick={() => void fetchProducts()}
          type="button"
        >
          Retry
        </Button>
      </div>
    );
  }

  const isSyncing = syncState?.loading;
  const syncVendorLabel = (v: SyncVendor) => (v === "printful" ? "Printful" : "Printify");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Product List</h2>
        <Link href="/products/create">
          <Button type="button" className="gap-2">
            <Plus className="h-4 w-4" />+ Add Product
          </Button>
        </Link>
      </div>

      {/* Printful & Printify sync – dedicated row so it’s easy to find */}
      <Card id="pod-sync" className="border-primary/20 bg-muted/20 scroll-mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Printful & Printify sync</CardTitle>
          <p className="text-sm text-muted-foreground">
            Pull catalog/inventory from your POD store, or push store changes (titles, descriptions, prices) to the vendor.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4 pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Printful</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isSyncing}
              onClick={() => runSync("printful", "from")}
              title="Pull mockups, inventory, shipping from Printful into the store"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Printful → Store
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isSyncing}
              onClick={() => runSync("printful", "to")}
              title="Push tags, SEO, descriptions, titles, prices from store to Printful"
            >
              <ArrowUpFromLine className="h-4 w-4" />
              Store → Printful
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Printify</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isSyncing}
              onClick={() => runSync("printify", "from")}
              title="Pull mockups, inventory, shipping from Printify into the store"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Printify → Store
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isSyncing}
              onClick={() => runSync("printify", "to")}
              title="Push tags, SEO, descriptions, titles, prices from store to Printify"
            >
              <ArrowUpFromLine className="h-4 w-4" />
              Store → Printify
            </Button>
          </div>
          {syncState?.loading && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {syncVendorLabel(syncState.vendor)}…
            </span>
          )}
          {syncState && !syncState.loading && syncState.result && (
            <span
              className={cn(
                "text-sm",
                syncState.result.success ? "text-green-600 dark:text-green-400" : "text-destructive",
              )}
            >
              {syncState.result.error
                ? syncState.result.error
                : syncState.direction === "from" && syncState.result.summary
                  ? `Imported: ${syncState.result.summary.imported ?? 0}, Updated: ${syncState.result.summary.updated ?? 0}, Skipped: ${syncState.result.summary.skipped ?? 0}`
                  : syncState.direction === "to" && syncState.result.summary
                    ? `Updated: ${syncState.result.summary.updated ?? 0}, Skipped: ${syncState.result.summary.skipped ?? 0}`
                    : "Done"}
            </span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="sr-only">Product list</CardTitle>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={cn(
                  "w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm",
                  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                )}
                placeholder="Search Product..."
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
                aria-label="Search products"
              />
            </div>
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
                      {COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          className={cn(
                            "whitespace-nowrap p-4 font-medium",
                            col.key === "price" && "text-right",
                            col.key === "action" && "text-right",
                            col.sortKey &&
                              "cursor-pointer select-none hover:bg-muted/70",
                          )}
                          scope="col"
                          onClick={() => {
                            if (!col.sortKey) return;
                            if (sortBy === col.sortKey) {
                              setSortOrder((o) =>
                                o === "asc" ? "desc" : "asc",
                              );
                            } else {
                              setSortBy(col.sortKey);
                              setSortOrder("asc");
                            }
                            setPage(1);
                          }}
                          onKeyDown={(e) => {
                            if (!col.sortKey) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              if (sortBy === col.sortKey) {
                                setSortOrder((o) =>
                                  o === "asc" ? "desc" : "asc",
                                );
                              } else {
                                setSortBy(col.sortKey);
                                setSortOrder("asc");
                              }
                              setPage(1);
                            }
                          }}
                          role={col.sortKey ? "button" : undefined}
                          tabIndex={col.sortKey ? 0 : undefined}
                          aria-sort={
                            col.sortKey && sortBy === col.sortKey
                              ? sortOrder === "asc"
                                ? "ascending"
                                : "descending"
                              : undefined
                          }
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            {col.sortKey ? (
                              sortBy === col.sortKey ? (
                                sortOrder === "asc" ? (
                                  <ArrowUp
                                    className="h-3.5 w-3.5 shrink-0"
                                    aria-hidden
                                  />
                                ) : (
                                  <ArrowDown
                                    className="h-3.5 w-3.5 shrink-0"
                                    aria-hidden
                                  />
                                )
                              ) : (
                                <ArrowUpDown
                                  className="h-3.5 w-3.5 shrink-0"
                                  aria-hidden
                                />
                              )
                            ) : null}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.length === 0 ? (
                      <tr>
                        <td
                          className="p-8 text-center text-muted-foreground"
                          colSpan={COLUMNS.length}
                        >
                          {search.trim()
                            ? "No products match your search."
                            : "No products yet."}
                        </td>
                      </tr>
                    ) : (
                      data.items.map((product) => (
                        <tr key={product.id} className="border-b last:border-0">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                                {product.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={product.imageUrl}
                                    alt=""
                                    className="size-full object-cover"
                                    width={40}
                                    height={40}
                                  />
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <Link
                                  href={`/products/${product.id}/edit`}
                                  className="font-medium text-primary underline underline-offset-2 hover:no-underline"
                                >
                                  {product.name}
                                </Link>
                                <p className="font-mono text-xs text-muted-foreground">
                                  #{product.id.slice(0, 8)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {product.categoryName ?? "—"}
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {product.brand ?? "—"}
                          </td>
                          <td className="p-4 text-right font-medium">
                            {formatPrice(product.priceCents)}
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {product.inventory ?? "Not tracked"}
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {product.vendor ?? "—"}
                          </td>
                          <td className="p-4">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={product.published}
                              disabled={togglingId === product.id}
                              onClick={() =>
                                handleTogglePublished(
                                  product.id,
                                  product.published,
                                )
                              }
                              className={cn(
                                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50",
                                product.published ? "bg-primary" : "bg-muted",
                              )}
                            >
                              <span
                                className={cn(
                                  "pointer-events-none inline-block size-5 translate-y-0.5 rounded-full bg-white shadow ring-0 transition-transform",
                                  product.published
                                    ? "translate-x-6"
                                    : "translate-x-0.5",
                                )}
                              />
                            </button>
                          </td>
                          <td className="p-4 text-right">
                            <span className="inline-flex items-center gap-1">
                              <Link
                                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                href={`/products/${product.id}/edit`}
                                aria-label={`Edit ${product.name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                              <a
                                href={`${API_BASE}/${product.slug?.trim() || product.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                aria-label={`View ${product.name}`}
                              >
                                <Eye className="h-4 w-4" />
                              </a>
                              <button
                                type="button"
                                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                aria-label={`Delete ${product.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {data.items.length > 0 && (
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
                                : "text-muted-foreground hover:bg-muted",
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
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
