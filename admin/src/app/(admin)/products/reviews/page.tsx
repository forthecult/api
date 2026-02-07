"use client";

import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

interface ReviewRow {
  id: string;
  productId: string;
  productName: string | null;
  productImageUrl: string | null;
  customerName: string;
  displayName: string;
  showName: boolean;
  userId: string | null;
  customerEmail: string | null;
  title: string | null;
  author: string | null;
  location: string | null;
  comment: string;
  rating: number;
  visible: boolean;
  createdAt: string;
}

interface ReviewsResponse {
  items: ReviewRow[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.min(5, Math.max(0, Math.round(rating)));
  const empty = 5 - full;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-amber-500"
      aria-label={`${rating} out of 5 stars`}
    >
      {Array.from({ length: full }, (_, i) => (
        <span key={`f-${i}`} className="text-base" aria-hidden>
          ★
        </span>
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <span
          key={`e-${i}`}
          className="text-base text-amber-500/40"
          aria-hidden
        >
          ☆
        </span>
      ))}
    </span>
  );
}

function formatReviewDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

const COLUMNS = [
  { key: "name", label: "Product" },
  { key: "customer", label: "Author" },
  { key: "date", label: "Date" },
  { key: "title", label: "Title" },
  { key: "comment", label: "Body" },
  { key: "rating", label: "Rating" },
  { key: "action", label: "Action" },
] as const;

export default function AdminProductsReviewsPage() {
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      const res = await fetch(
        `${API_BASE}/api/admin/reviews?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ReviewsResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reviews");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void fetchReviews();
  }, [fetchReviews]);

  const handleToggleVisible = useCallback(
    async (id: string, current: boolean) => {
      setTogglingId(id);
      try {
        const res = await fetch(`${API_BASE}/api/admin/reviews/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ visible: !current }),
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
                items: prev.items.map((r) =>
                  r.id === id ? { ...r, visible: !current } : r,
                ),
              }
            : null,
        );
      } catch {
        void fetchReviews();
      } finally {
        setTogglingId(null);
      }
    },
    [fetchReviews],
  );

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
        {error}
        <Button
          className="mt-2"
          onClick={() => void fetchReviews()}
          type="button"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Product Reviews</h2>

      <Card>
        <CardHeader>
          <CardTitle className="sr-only">Product reviews</CardTitle>
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
                            (col.key === "rating" || col.key === "action") &&
                              "text-right",
                          )}
                          scope="col"
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            <ArrowUpDown
                              className="h-3.5 w-3.5 shrink-0"
                              aria-hidden
                            />
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
                          No reviews yet.
                        </td>
                      </tr>
                    ) : (
                      data.items.map((review) => (
                        <tr key={review.id} className="border-b last:border-0">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                                {review.productImageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={review.productImageUrl}
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
                              <span className="font-medium">
                                {review.productName ?? "—"}
                              </span>
                            </div>
                          </td>
                          <td
                            className="p-4 text-muted-foreground"
                            title={review.customerName}
                          >
                            {review.userId ? (
                              <Link
                                href={`/customers/${review.userId}`}
                                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                              >
                                {review.displayName}
                                <ExternalLink
                                  className="h-3.5 w-3.5 shrink-0"
                                  aria-hidden
                                />
                              </Link>
                            ) : (
                              <span>
                                {review.displayName}
                                {review.location ? (
                                  <span className="text-muted-foreground/80">
                                    {" · "}
                                    {review.location}
                                  </span>
                                ) : null}
                              </span>
                            )}
                          </td>
                          <td
                            className="whitespace-nowrap p-4 text-muted-foreground"
                            title={review.createdAt}
                          >
                            {formatReviewDate(review.createdAt)}
                          </td>
                          <td className="max-w-[160px] truncate p-4 text-muted-foreground">
                            {review.title ?? "—"}
                          </td>
                          <td className="max-w-[280px] truncate p-4 text-muted-foreground">
                            {review.comment}
                          </td>
                          <td className="p-4 text-right">
                            <StarRating rating={review.rating} />
                          </td>
                          <td className="p-4 text-right">
                            <button
                              type="button"
                              disabled={togglingId === review.id}
                              onClick={() =>
                                handleToggleVisible(review.id, review.visible)
                              }
                              className={cn(
                                "rounded p-1.5 transition-colors disabled:opacity-50",
                                review.visible
                                  ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                                  : "text-amber-600 hover:bg-amber-500/10 dark:text-amber-400",
                              )}
                              title={
                                review.visible ? "Hide review" : "Show review"
                              }
                              aria-label={
                                review.visible
                                  ? "Hide review on website"
                                  : "Show review on website"
                              }
                            >
                              {review.visible ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                            </button>
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
