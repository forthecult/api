"use client";

import {
  Calendar,
  ChevronLeft,
  ChevronRight,
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

interface BlogListResponse {
  items: BlogRow[];
  limit: number;
  page: number;
  totalCount: number;
  totalPages: number;
}

interface BlogRow {
  authorDisplayName: null | string;
  coverImageUrl: null | string;
  createdAt: string;
  id: string;
  publishedAt: null | string;
  slug: string;
  tags: string[];
  title: string;
  updatedAt: string;
}

const COLUMNS = [
  { key: "title", label: "Title" },
  { key: "slug", label: "Slug" },
  { key: "author", label: "Author" },
  { key: "cover", label: "Cover" },
  { key: "published", label: "Published" },
  { key: "action", label: "Action" },
] as const;

function formatDate(s: null | string): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString();
}

function isPublished(row: BlogRow): boolean {
  if (!row.publishedAt) return false;
  return new Date(row.publishedAt) <= new Date();
}

export default function AdminBlogPage() {
  const [data, setData] = useState<BlogListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<null | string>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch((prev) => (prev === searchInput.trim() ? prev : searchInput.trim()));
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "10", page: String(page) });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(
        `${API_BASE}/api/admin/blog?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as BlogListResponse;
      setData(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load blog posts",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  const handleDelete = useCallback(
    async (id: string, title: string) => {
      if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
      setDeletingId(id);
      try {
        const res = await fetch(`${API_BASE}/api/admin/blog/${id}`, {
          credentials: "include",
          method: "DELETE",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Failed to delete");
        }
        setData((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.filter((r) => r.id !== id),
                totalCount: Math.max(0, prev.totalCount - 1),
              }
            : null,
        );
      } catch {
        void fetchPosts();
      } finally {
        setDeletingId(null);
      }
    },
    [fetchPosts],
  );

  if (error && !data) {
    return (
      <div
        className={`
        rounded-lg border border-red-200 bg-red-50 p-4 text-red-800
        dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
      `}
      >
        {error}
        <Button className="mt-2" onClick={() => void fetchPosts()} type="button">
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
        <h2 className="text-2xl font-semibold tracking-tight">Blog</h2>
        <Link href="/blog/create">
          <Button className="gap-2" type="button">
            <Plus className="size-4" /> New post
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader
          className={`
          flex flex-col gap-4
          sm:flex-row sm:items-center sm:justify-between
        `}
        >
          <CardTitle className="sr-only">Blog posts</CardTitle>
          <div className="relative max-w-md flex-1">
            <Search
              className={`
              absolute top-1/2 left-3 size-4 -translate-y-1/2
              text-muted-foreground
            `}
            />
            <input
              aria-label="Search posts"
              className={cn(
                `
                  w-full rounded-md border border-input bg-background py-2 pr-3
                  pl-9 text-sm
                `,
                `
                  placeholder:text-muted-foreground
                  focus-visible:ring-2 focus-visible:ring-ring
                  focus-visible:outline-none
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
              placeholder="Search by title, slug, author…"
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
          ) : data ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className={`
                      border-b bg-muted/50 text-left text-xs font-semibold
                      tracking-wider text-muted-foreground uppercase
                    `}
                    >
                      {COLUMNS.map((col) => (
                        <th
                          className="whitespace-nowrap p-4 font-medium"
                          key={col.key}
                          scope="col"
                        >
                          {col.label}
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
                            ? "No posts match your search."
                            : "No blog posts yet."}
                        </td>
                      </tr>
                    ) : (
                      data.items.map((row) => (
                        <tr
                          className="border-b last:border-0"
                          key={row.id}
                        >
                          <td className="max-w-[200px] truncate p-4 font-medium">
                            <Link
                              className={`
                                text-primary underline-offset-4
                                hover:underline
                              `}
                              href={`/blog/${row.id}`}
                            >
                              {row.title}
                            </Link>
                          </td>
                          <td className="p-4 font-mono text-muted-foreground">
                            /blog/{row.slug}
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {row.authorDisplayName ?? "—"}
                          </td>
                          <td className="p-4">
                            <div
                              className={`
                              relative size-10 overflow-hidden rounded-md border
                              bg-muted
                            `}
                            >
                              {row.coverImageUrl ? (
                                <Image
                                  alt=""
                                  className="object-cover"
                                  fill
                                  sizes="40px"
                                  src={row.coverImageUrl}
                                />
                              ) : (
                                <div
                                  className={`
                                  flex size-full items-center justify-center
                                  text-xs text-muted-foreground
                                `}
                                >
                                  —
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1",
                                isPublished(row)
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-muted-foreground",
                              )}
                              title={row.publishedAt ?? "Draft"}
                            >
                              <Calendar className="size-3.5" />
                              {formatDate(row.publishedAt)}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Link
                                aria-label={`Edit ${row.title}`}
                                className={`
                                  rounded p-1.5 text-muted-foreground
                                  hover:bg-muted hover:text-foreground
                                `}
                                href={`/blog/${row.id}`}
                              >
                                <Pencil className="size-4" />
                              </Link>
                              <button
                                aria-label={`Delete ${row.title}`}
                                className={`
                                  rounded p-1.5 text-muted-foreground
                                  hover:bg-destructive/10 hover:text-destructive
                                  disabled:opacity-50
                                `}
                                disabled={deletingId === row.id}
                                onClick={() => handleDelete(row.id, row.title)}
                                type="button"
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
              {data.items.length > 0 && data.totalPages > 1 && (
                <div
                  className={`
                  flex items-center justify-center gap-2 border-t p-4
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
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {data.page} of {data.totalPages}
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
