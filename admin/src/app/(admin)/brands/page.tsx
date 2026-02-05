"use client";

import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

type BrandRow = {
  id: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  description: string | null;
  featured: boolean;
  createdAt: string;
};

type BrandsResponse = {
  items: BrandRow[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
};

const COLUMNS = [
  { key: "id", label: "ID" },
  { key: "name", label: "Name", sortable: true as const },
  { key: "logo", label: "Logo" },
  { key: "website", label: "Website" },
  { key: "featured", label: "Featured" },
  { key: "action", label: "Action" },
] as const;

type SortBy = "name" | "createdAt";
type SortOrder = "asc" | "desc";

export default function AdminBrandsPage() {
  const [data, setData] = useState<BrandsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (search.trim()) params.set("search", search.trim());
      params.set("sortBy", sortBy);
      params.set("order", sortOrder);
      const res = await fetch(
        `${API_BASE}/api/admin/brands?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as BrandsResponse;
      setData(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load brands",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, sortOrder]);

  useEffect(() => {
    void fetchBrands();
  }, [fetchBrands]);

  const handleToggleFeatured = useCallback(
    async (id: string, current: boolean) => {
      setTogglingId(id);
      try {
        const res = await fetch(`${API_BASE}/api/admin/brands/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ featured: !current }),
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
                items: prev.items.map((b) =>
                  b.id === id ? { ...b, featured: !current } : b,
                ),
              }
            : null,
        );
      } catch {
        void fetchBrands();
      } finally {
        setTogglingId(null);
      }
    },
    [fetchBrands],
  );

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      if (
        !window.confirm(`Delete brand "${name}"? This cannot be undone.`)
      ) {
        return;
      }
      setDeletingId(id);
      try {
        const res = await fetch(`${API_BASE}/api/admin/brands/${id}`, {
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
            ? {
                ...prev,
                items: prev.items.filter((b) => b.id !== id),
                totalCount: Math.max(0, prev.totalCount - 1),
              }
            : null,
        );
      } catch {
        void fetchBrands();
      } finally {
        setDeletingId(null);
      }
    },
    [fetchBrands],
  );

  const totalPages = data?.totalPages ?? 1;

  const handleSort = useCallback((columnKey: SortBy) => {
    setSortBy(columnKey);
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    setPage(1);
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
        {error}
        <Button
          className="mt-2"
          onClick={() => void fetchBrands()}
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
          Product Brands
        </h2>
        <Link href="/brands/create">
          <Button type="button" className="gap-2">
            <Plus className="size-4" />+ Add Brand
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="sr-only">Product brands</CardTitle>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search Brand..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setSearch(searchInput);
                  setPage(1);
                }
              }}
              className={cn(
                "w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              aria-label="Search brands"
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
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
              Loading…
            </div>
          ) : data ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {COLUMNS.map((col) => {
                        const isSortable =
                          "sortable" in col && col.sortable && col.key === "name";
                        const isActive = isSortable && sortBy === col.key;
                        return (
                          <th
                            key={col.key}
                            className={cn(
                              "whitespace-nowrap p-4 font-medium",
                              isSortable &&
                                "cursor-pointer select-none hover:bg-muted/70",
                            )}
                            scope="col"
                            onClick={() =>
                              isSortable
                                ? handleSort(col.key as SortBy)
                                : undefined
                            }
                            onKeyDown={(e) =>
                              isSortable &&
                              (e.key === "Enter" || e.key === " ") &&
                              handleSort(col.key as SortBy)
                            }
                            role={isSortable ? "button" : undefined}
                            tabIndex={isSortable ? 0 : undefined}
                            aria-sort={
                              isActive
                                ? sortOrder === "asc"
                                  ? "ascending"
                                  : "descending"
                                : undefined
                            }
                          >
                            <span className="inline-flex items-center gap-1">
                              {col.label}
                              {isSortable ? (
                                isActive ? (
                                  sortOrder === "asc" ? (
                                    <ChevronUp
                                      className="size-4 shrink-0 text-foreground"
                                      aria-hidden
                                    />
                                  ) : (
                                    <ChevronDown
                                      className="size-4 shrink-0 text-foreground"
                                      aria-hidden
                                    />
                                  )
                                ) : (
                                  <ArrowUpDown
                                    className="size-4 shrink-0 text-muted-foreground"
                                    aria-hidden
                                  />
                                )
                              ) : null}
                            </span>
                          </th>
                        );
                      })}
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
                            ? "No brands match your search."
                            : "No brands yet. Add a brand to get started."}
                        </td>
                      </tr>
                    ) : (
                      data.items.map((row) => (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="p-4 font-mono text-muted-foreground">
                            #{row.id.slice(0, 8)}
                          </td>
                          <td className="p-4 font-medium">
                            <Link
                              href={`/brands/${row.id}`}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {row.name}
                            </Link>
                          </td>
                          <td className="p-4">
                            <div className="relative size-10 overflow-hidden rounded-md border bg-muted">
                              {row.logoUrl ? (
                                <Image
                                  src={row.logoUrl}
                                  alt=""
                                  fill
                                  className="object-contain"
                                  sizes="40px"
                                />
                              ) : (
                                <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                                  —
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-4 max-w-[180px] truncate">
                            {row.websiteUrl ? (
                              <a
                                href={row.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {row.websiteUrl}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-4">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={row.featured}
                              disabled={togglingId === row.id}
                              onClick={() =>
                                handleToggleFeatured(row.id, row.featured)
                              }
                              className={cn(
                                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50",
                                row.featured ? "bg-primary" : "bg-muted",
                              )}
                            >
                              <span
                                className={cn(
                                  "pointer-events-none inline-block size-5 translate-y-0.5 rounded-full bg-white shadow ring-0 transition-transform",
                                  row.featured
                                    ? "translate-x-6"
                                    : "translate-x-0.5",
                                )}
                              />
                            </button>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/brands/${row.id}`}
                                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label={`Edit ${row.name}`}
                              >
                                <Pencil className="size-4" />
                              </Link>
                              <button
                                type="button"
                                disabled={deletingId === row.id}
                                onClick={() => handleDelete(row.id, row.name)}
                                className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                aria-label={`Delete ${row.name}`}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {data.items.length > 0 && (
                <div className="flex items-center justify-center gap-2 border-t p-4">
                  <Button
                    disabled={data.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    size="sm"
                    type="button"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const start = Math.max(
                        1,
                        Math.min(data.page - 4, totalPages - 4),
                      );
                      const pageNum = Math.min(start + i, totalPages);
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
                    })}
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
                    <ChevronRight className="size-4" />
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
