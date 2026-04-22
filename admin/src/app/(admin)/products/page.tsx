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
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "~/lib/cn";
import { getAdminApiBaseUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";
import { CategorySelect } from "~/ui/category-select";

const API_BASE = getAdminApiBaseUrl();

interface ProductRow {
  brand: null | string;
  categoryId: null | string;
  categoryName: null | string;
  id: string;
  imageUrl: null | string;
  inventory: string;
  name: string;
  priceCents: number;
  published: boolean;
  slug?: null | string;
  vendor: null | string;
}
interface ProductsResponse {
  items: ProductRow[];
  limit: number;
  page: number;
  totalCount: number;
  totalPages: number;
}

type SyncDirection = "from" | "to";

interface SyncState {
  direction: SyncDirection;
  loading: boolean;
  result?: {
    error?: string;
    errors?: string[];
    success: boolean;
    summary?: {
      errors?: number;
      imported?: number;
      skipped?: number;
      updated?: number;
    };
  };
  vendor: SyncVendor;
}

type SyncVendor = "printful" | "printify";

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(cents / 100);
}

const _sortableColumns = [
  "name",
  "category",
  "brand",
  "vendor",
  "price",
  "published",
  "inStock",
] as const;
type SortBy = (typeof _sortableColumns)[number];

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

interface CategoryOption {
  id: string;
  name: string;
  parentName?: null | string;
}

export default function AdminProductsPage() {
  const [data, setData] = useState<null | ProductsResponse>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterVendor, setFilterVendor] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [vendorOptions, setVendorOptions] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [togglingId, setTogglingId] = useState<null | string>(null);
  const [deletingId, setDeletingId] = useState<null | string>(null);
  const [syncState, setSyncState] = useState<null | SyncState>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<
    "delete" | "publish" | "unpublish" | null
  >(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [catRes, venRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/categories?limit=500`, {
            credentials: "include",
          }),
          fetch(`${API_BASE}/api/admin/products/vendors`, {
            credentials: "include",
          }),
        ]);
        if (catRes.ok) {
          const catJson = (await catRes.json()) as { items?: CategoryOption[] };
          const items = catJson.items ?? [];
          setCategoryOptions([{ id: "", name: "All categories" }, ...items]);
        }
        if (venRes.ok) {
          const venJson = (await venRes.json()) as { vendors?: string[] };
          setVendorOptions(venJson.vendors ?? []);
        }
      } catch {
        // Non-blocking; filters just stay empty
      }
    };
    void loadFilterOptions();
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: "10",
        page: String(page),
        sortBy,
        sortOrder,
      });
      if (search.trim()) params.set("search", search.trim());
      if (filterCategoryId.trim())
        params.set("categoryId", filterCategoryId.trim());
      if (filterVendor.trim()) params.set("vendor", filterVendor.trim());
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
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterCategoryId, filterVendor, sortBy, sortOrder]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const handleDelete = useCallback(
    async (product: ProductRow) => {
      if (
        !window.confirm(
          `Delete "${product.name}"? This will remove the product and its variants, images, and tags. Orders that included this product will keep the line item but the product link will be cleared.`,
        )
      ) {
        return;
      }
      setDeletingId(product.id);
      try {
        const res = await fetch(
          `${API_BASE}/api/admin/products/${product.id}`,
          { credentials: "include", method: "DELETE" },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Failed to delete");
        }
        await fetchProducts();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to delete product",
        );
      } finally {
        setDeletingId(null);
      }
    },
    [fetchProducts],
  );

  const runSync = useCallback(
    async (vendor: SyncVendor, direction: SyncDirection) => {
      setSyncState({ direction, loading: true, vendor });
      const base = `${API_BASE}/api/admin/${vendor}/sync`;
      try {
        if (direction === "from") {
          // Vendor → Store: mockups, inventory, shipping
          const res = await fetch(base, {
            body: JSON.stringify({
              action: "import_all",
              overwrite: true,
            }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });
          const json = (await res
            .json()
            .catch(() => ({}))) as SyncState["result"] & { error?: string };
          if (!res.ok) {
            setSyncState((s) =>
              s
                ? {
                    ...s,
                    loading: false,
                    result: {
                      error: json.error ?? "Sync failed",
                      success: false,
                    },
                  }
                : null,
            );
            return;
          }
          setSyncState((s) =>
            s
              ? {
                  ...s,
                  loading: false,
                  result: { ...json, success: json.success !== false },
                }
              : null,
          );
        } else {
          // Store → Vendor: tags, SEO, descriptions, titles (and prices/SKU per backend)
          const res = await fetch(base, {
            body: JSON.stringify({ action: "export_all" }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });
          const json = (await res
            .json()
            .catch(() => ({}))) as SyncState["result"] & { error?: string };
          if (!res.ok) {
            setSyncState((s) =>
              s
                ? {
                    ...s,
                    loading: false,
                    result: {
                      error: json.error ?? "Sync failed",
                      success: false,
                    },
                  }
                : null,
            );
            return;
          }
          setSyncState((s) =>
            s
              ? {
                  ...s,
                  loading: false,
                  result: { ...json, success: json.success !== false },
                }
              : null,
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
                  error: err instanceof Error ? err.message : "Sync failed",
                  success: false,
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
          body: JSON.stringify({ published: !current }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
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

  const visibleIds = data?.items.map((p) => p.id) ?? [];
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someSelected = selectedIds.length > 0;
  const _isIndeterminate = someSelected && !allSelected;

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => [
        ...prev.filter((id) => !visibleIds.includes(id)),
        ...visibleIds,
      ]);
    }
  }, [allSelected, visibleIds]);

  const handleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleBulkPublish = useCallback(
    async (published: boolean) => {
      if (selectedIds.length === 0) return;
      setBulkAction(published ? "publish" : "unpublish");
      try {
        const results = await Promise.allSettled(
          selectedIds.map((id) =>
            fetch(`${API_BASE}/api/admin/products/${id}`, {
              body: JSON.stringify({ published }),
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              method: "PATCH",
            }),
          ),
        );
        const failed = results.filter(
          (r) =>
            r.status === "rejected" ||
            (r.status === "fulfilled" &&
              !(r as PromiseFulfilledResult<Response>).value.ok),
        );
        if (failed.length > 0) {
          setError(`Failed to update ${failed.length} product(s).`);
        }
        setSelectedIds([]);
        await fetchProducts();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bulk update failed");
      } finally {
        setBulkAction(null);
      }
    },
    [selectedIds, fetchProducts],
  );

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `Delete ${selectedIds.length} selected product(s)? This will remove the products and their variants, images, and tags.`,
      )
    ) {
      return;
    }
    setBulkAction("delete");
    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) =>
          fetch(`${API_BASE}/api/admin/products/${id}`, {
            credentials: "include",
            method: "DELETE",
          }),
        ),
      );
      const failed = results.filter(
        (r) =>
          r.status === "rejected" ||
          (r.status === "fulfilled" &&
            !(r as PromiseFulfilledResult<Response>).value.ok),
      );
      if (failed.length > 0) {
        setError(`Failed to delete ${failed.length} product(s).`);
      }
      setSelectedIds([]);
      await fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk delete failed");
    } finally {
      setBulkAction(null);
    }
  }, [selectedIds, fetchProducts]);

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
          onClick={() => void fetchProducts()}
          type="button"
        >
          Retry
        </Button>
      </div>
    );
  }

  const isSyncing = syncState?.loading;
  const syncVendorLabel = (v: SyncVendor) =>
    v === "printful" ? "Printful" : "Printify";

  return (
    <div className="space-y-6">
      <div
        className={`
          flex flex-col gap-4
          sm:flex-row sm:items-center sm:justify-between
        `}
      >
        <h2 className="text-2xl font-semibold tracking-tight">Product List</h2>
        <Link href="/products/create">
          <Button className="gap-2" type="button">
            <Plus className="h-4 w-4" />+ Add Product
          </Button>
        </Link>
      </div>

      {/* Printful & Printify sync – dedicated row so it’s easy to find */}
      <Card className="scroll-mt-4 border-primary/20 bg-muted/20" id="pod-sync">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Printful & Printify sync</CardTitle>
          <p className="text-sm text-muted-foreground">
            Pull catalog/inventory from your POD store, or push store changes
            (titles, descriptions, prices) to the vendor.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4 pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Printful
            </span>
            <Button
              className="gap-1.5"
              disabled={isSyncing}
              onClick={() => runSync("printful", "from")}
              size="sm"
              title="Pull mockups, inventory, shipping from Printful into the store"
              type="button"
              variant="outline"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Printful → Store
            </Button>
            <Button
              className="gap-1.5"
              disabled={isSyncing}
              onClick={() => runSync("printful", "to")}
              size="sm"
              title="Push tags, SEO, descriptions, titles, prices from store to Printful"
              type="button"
              variant="outline"
            >
              <ArrowUpFromLine className="h-4 w-4" />
              Store → Printful
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Printify
            </span>
            <Button
              className="gap-1.5"
              disabled={isSyncing}
              onClick={() => runSync("printify", "from")}
              size="sm"
              title="Pull mockups, inventory, shipping from Printify into the store"
              type="button"
              variant="outline"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Printify → Store
            </Button>
            <Button
              className="gap-1.5"
              disabled={isSyncing}
              onClick={() => runSync("printify", "to")}
              size="sm"
              title="Push tags, SEO, descriptions, titles, prices from store to Printify"
              type="button"
              variant="outline"
            >
              <ArrowUpFromLine className="h-4 w-4" />
              Store → Printify
            </Button>
          </div>
          {syncState?.loading && (
            <span
              className={`
                flex items-center gap-1.5 text-sm text-muted-foreground
              `}
            >
              <RefreshCw className="h-4 w-4 animate-spin" />
              {syncVendorLabel(syncState.vendor)}…
            </span>
          )}
          {syncState && !syncState.loading && syncState.result && (
            <span
              className={cn(
                "text-sm",
                syncState.result.success
                  ? `
                    text-green-600
                    dark:text-green-400
                  `
                  : "text-destructive",
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
          <div
            className={`
              flex flex-col gap-4
              sm:flex-row sm:items-center sm:justify-between
            `}
          >
            <CardTitle className="sr-only">Product list</CardTitle>
            <div className="relative max-w-md flex-1">
              <Search
                className={`
                  absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2
                  text-muted-foreground
                `}
              />
              <input
                aria-label="Search products"
                className={cn(
                  `
                    w-full rounded-md border border-input bg-background py-2
                    pr-3 pl-9 text-sm
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
                placeholder="Search Product..."
                type="search"
                value={searchInput}
              />
            </div>
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
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <label
                className="shrink-0 text-sm font-medium text-muted-foreground"
                htmlFor="filter-category"
              >
                Category
              </label>
              <CategorySelect
                className="min-w-[180px]"
                id="filter-category"
                onChange={(value) => {
                  setFilterCategoryId(value);
                  setPage(1);
                }}
                options={categoryOptions}
                placeholder="All categories"
                value={filterCategoryId}
              />
            </div>
            <div className="flex items-center gap-2">
              <label
                className="shrink-0 text-sm font-medium text-muted-foreground"
                htmlFor="filter-vendor"
              >
                Vendor
              </label>
              <select
                aria-label="Filter by vendor"
                className={cn(
                  `
                    min-w-[140px] rounded-md border border-input bg-background
                    px-3 py-2 text-sm
                  `,
                  `
                    ring-offset-background
                    focus:ring-2 focus:ring-ring focus:outline-none
                  `,
                )}
                id="filter-vendor"
                onChange={(e) => {
                  setFilterVendor(e.target.value);
                  setPage(1);
                }}
                value={filterVendor}
              >
                <option value="">All vendors</option>
                {vendorOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
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
              {someSelected && (
                <div
                  className={`
                    mb-4 flex flex-wrap items-center gap-3 rounded-md border
                    border-border bg-muted/30 px-4 py-3
                  `}
                >
                  <span className="text-sm font-medium">
                    {selectedIds.length} selected
                  </span>
                  <Button
                    disabled={!!bulkAction}
                    onClick={() => handleBulkPublish(true)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {bulkAction === "publish" ? "Publishing…" : "Bulk publish"}
                  </Button>
                  <Button
                    disabled={!!bulkAction}
                    onClick={() => handleBulkPublish(false)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {bulkAction === "unpublish"
                      ? "Unpublishing…"
                      : "Bulk unpublish"}
                  </Button>
                  <Button
                    className={`
                      text-destructive
                      hover:bg-destructive/10 hover:text-destructive
                    `}
                    disabled={!!bulkAction}
                    onClick={() => void handleBulkDelete()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {bulkAction === "delete" ? "Deleting…" : "Bulk delete"}
                  </Button>
                  <Button
                    disabled={!!bulkAction}
                    onClick={() => setSelectedIds([])}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Clear selection
                  </Button>
                </div>
              )}
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
                      <th className="w-10 p-4 whitespace-nowrap" scope="col">
                        <label
                          className={`
                            flex cursor-pointer items-center justify-center
                          `}
                        >
                          <input
                            aria-label="Select all products on this page"
                            checked={allSelected}
                            className="h-4 w-4 rounded border-input"
                            onChange={handleSelectAll}
                            ref={selectAllRef}
                            type="checkbox"
                          />
                        </label>
                      </th>
                      {COLUMNS.map((col) => (
                        <th
                          aria-sort={
                            col.sortKey && sortBy === col.sortKey
                              ? sortOrder === "asc"
                                ? "ascending"
                                : "descending"
                              : undefined
                          }
                          className={cn(
                            "p-4 font-medium whitespace-nowrap",
                            col.key === "price" && "text-right",
                            col.key === "action" && "text-right",
                            col.sortKey &&
                              `
                                cursor-pointer select-none
                                hover:bg-muted/70
                              `,
                          )}
                          key={col.key}
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
                          scope="col"
                          tabIndex={col.sortKey ? 0 : undefined}
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            {col.sortKey ? (
                              sortBy === col.sortKey ? (
                                sortOrder === "asc" ? (
                                  <ArrowUp
                                    aria-hidden
                                    className="h-3.5 w-3.5 shrink-0"
                                  />
                                ) : (
                                  <ArrowDown
                                    aria-hidden
                                    className="h-3.5 w-3.5 shrink-0"
                                  />
                                )
                              ) : (
                                <ArrowUpDown
                                  aria-hidden
                                  className="h-3.5 w-3.5 shrink-0"
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
                          colSpan={COLUMNS.length + 1}
                        >
                          {search.trim()
                            ? "No products match your search."
                            : "No products yet."}
                        </td>
                      </tr>
                    ) : (
                      data.items.map((product) => (
                        <tr
                          className={`
                            border-b
                            last:border-0
                          `}
                          key={product.id}
                        >
                          <td className="w-10 p-4">
                            <label
                              className={`
                                flex cursor-pointer items-center justify-center
                              `}
                            >
                              <input
                                aria-label={`Select ${product.name}`}
                                checked={selectedIds.includes(product.id)}
                                className="h-4 w-4 rounded border-input"
                                onChange={() => handleSelectOne(product.id)}
                                type="checkbox"
                              />
                            </label>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`
                                  relative flex h-10 w-10 shrink-0 items-center
                                  justify-center overflow-hidden rounded-md
                                  border bg-muted
                                `}
                              >
                                {product.imageUrl ? (
                                  <img
                                    alt=""
                                    className="size-full object-cover"
                                    height={40}
                                    src={product.imageUrl}
                                    width={40}
                                  />
                                ) : (
                                  <span
                                    className={`text-xs text-muted-foreground`}
                                  >
                                    —
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <Link
                                  className={`
                                    font-medium text-primary underline
                                    underline-offset-2
                                    hover:no-underline
                                  `}
                                  href={`/products/${product.id}/edit`}
                                >
                                  {product.name}
                                </Link>
                                <p
                                  className={`
                                    font-mono text-xs text-muted-foreground
                                  `}
                                >
                                  #{product.id.slice(0, 8)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {product.categoryId && product.categoryName ? (
                              <Link
                                className={`
                                  text-primary underline underline-offset-2
                                  hover:no-underline
                                `}
                                href={`/categories/${product.categoryId}`}
                              >
                                {product.categoryName}
                              </Link>
                            ) : (
                              (product.categoryName ?? "—")
                            )}
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
                              aria-checked={product.published}
                              className={cn(
                                `
                                  relative inline-flex h-6 w-11 shrink-0
                                  cursor-pointer rounded-full border-2
                                  border-transparent transition-colors
                                  focus-visible:ring-2 focus-visible:ring-ring
                                  focus-visible:ring-offset-2
                                  focus-visible:outline-none
                                  disabled:opacity-50
                                `,
                                product.published ? "bg-primary" : "bg-muted",
                              )}
                              disabled={togglingId === product.id}
                              onClick={() =>
                                handleTogglePublished(
                                  product.id,
                                  product.published,
                                )
                              }
                              role="switch"
                              type="button"
                            >
                              <span
                                className={cn(
                                  `
                                    pointer-events-none inline-block size-5
                                    translate-y-0.5 rounded-full bg-white shadow
                                    ring-0 transition-transform
                                  `,
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
                                aria-label={`Edit ${product.name}`}
                                className={`
                                  rounded p-1.5 text-muted-foreground
                                  transition-colors
                                  hover:bg-muted hover:text-foreground
                                `}
                                href={`/products/${product.id}/edit`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                              <a
                                aria-label={`View ${product.name}`}
                                className={`
                                  rounded p-1.5 text-muted-foreground
                                  transition-colors
                                  hover:bg-muted hover:text-foreground
                                `}
                                href={`${API_BASE}/${product.slug?.trim() || product.id}`}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                <Eye className="h-4 w-4" />
                              </a>
                              <button
                                aria-label={`Delete ${product.name}`}
                                className={`
                                  rounded p-1.5 text-muted-foreground
                                  transition-colors
                                  hover:bg-destructive/10 hover:text-destructive
                                  disabled:pointer-events-none
                                  disabled:opacity-50
                                `}
                                disabled={deletingId === product.id}
                                onClick={() => handleDelete(product)}
                                type="button"
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
                <div
                  className={`
                    mt-4 flex items-center justify-center gap-2 border-t pt-4
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
                            aria-current={isCurrent ? "page" : undefined}
                            aria-label={`Page ${pageNum}`}
                            className={cn(
                              `
                                flex h-8 w-8 items-center justify-center
                                rounded-full text-sm font-medium
                                transition-colors
                              `,
                              isCurrent
                                ? "bg-primary text-primary-foreground"
                                : `
                                  text-muted-foreground
                                  hover:bg-muted
                                `,
                            )}
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            type="button"
                          >
                            {pageNum}
                          </button>
                        );
                      });
                    })()}
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
