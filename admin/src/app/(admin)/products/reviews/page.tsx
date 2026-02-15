"use client";

import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

interface ReviewRow {
  author: null | string;
  comment: string;
  createdAt: string;
  customerEmail: null | string;
  customerName: string;
  displayName: string;
  id: string;
  location: null | string;
  productId: string;
  productImageUrl: null | string;
  productName: null | string;
  rating: number;
  showName: boolean;
  title: null | string;
  userId: null | string;
  visible: boolean;
}

interface ReviewsResponse {
  items: ReviewRow[];
  limit: number;
  page: number;
  totalCount: number;
  totalPages: number;
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

function StarRating({ rating }: { rating: number }) {
  const full = Math.min(5, Math.max(0, Math.round(rating)));
  const empty = 5 - full;
  return (
    <span
      aria-label={`${rating} out of 5 stars`}
      className="inline-flex items-center gap-0.5 text-amber-500"
    >
      {Array.from({ length: full }, (_, i) => (
        <span aria-hidden className="text-base" key={`f-${i}`}>
          ★
        </span>
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <span
          aria-hidden
          className="text-base text-amber-500/40"
          key={`e-${i}`}
        >
          ☆
        </span>
      ))}
    </span>
  );
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
  const [data, setData] = useState<null | ReviewsResponse>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
  const [page, setPage] = useState(1);
  const [togglingId, setTogglingId] = useState<null | string>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "10", page: String(page) });
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
          body: JSON.stringify({ visible: !current }),
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
      <div
        className={`
        rounded-lg border border-red-200 bg-red-50 p-4 text-red-800
        dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
      `}
      >
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
                      {COLUMNS.map((col) => (
                        <th
                          className={cn(
                            "p-4 font-medium whitespace-nowrap",
                            (col.key === "rating" || col.key === "action") &&
                              "text-right",
                          )}
                          key={col.key}
                          scope="col"
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            <ArrowUpDown
                              aria-hidden
                              className="h-3.5 w-3.5 shrink-0"
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
                        <tr
                          className={`
                          border-b
                          last:border-0
                        `}
                          key={review.id}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`
                                relative flex h-10 w-10 shrink-0 items-center
                                justify-center overflow-hidden rounded-md border
                                bg-muted
                              `}
                              >
                                {review.productImageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    alt=""
                                    className="size-full object-cover"
                                    height={40}
                                    src={review.productImageUrl}
                                    width={40}
                                  />
                                ) : (
                                  <span
                                    className={`
                                    text-xs text-muted-foreground
                                  `}
                                  >
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
                                className={`
                                  inline-flex items-center gap-1 text-primary
                                  underline-offset-4
                                  hover:underline
                                `}
                                href={`/customers/${review.userId}`}
                              >
                                {review.displayName}
                                <ExternalLink
                                  aria-hidden
                                  className="h-3.5 w-3.5 shrink-0"
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
                            className={`
                              p-4 whitespace-nowrap text-muted-foreground
                            `}
                            title={review.createdAt}
                          >
                            {formatReviewDate(review.createdAt)}
                          </td>
                          <td
                            className={`
                            max-w-[160px] truncate p-4 text-muted-foreground
                          `}
                          >
                            {review.title ?? "—"}
                          </td>
                          <td
                            className={`
                            max-w-[280px] truncate p-4 text-muted-foreground
                          `}
                          >
                            {review.comment}
                          </td>
                          <td className="p-4 text-right">
                            <StarRating rating={review.rating} />
                          </td>
                          <td className="p-4 text-right">
                            <button
                              aria-label={
                                review.visible
                                  ? "Hide review on website"
                                  : "Show review on website"
                              }
                              className={cn(
                                `
                                  rounded p-1.5 transition-colors
                                  disabled:opacity-50
                                `,
                                review.visible
                                  ? `
                                    text-muted-foreground
                                    hover:bg-muted hover:text-foreground
                                  `
                                  : `
                                    text-amber-600
                                    hover:bg-amber-500/10
                                    dark:text-amber-400
                                  `,
                              )}
                              disabled={togglingId === review.id}
                              onClick={() =>
                                handleToggleVisible(review.id, review.visible)
                              }
                              title={
                                review.visible ? "Hide review" : "Show review"
                              }
                              type="button"
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
