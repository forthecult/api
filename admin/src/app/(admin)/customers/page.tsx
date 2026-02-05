"use client";

import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
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

interface CustomerRow {
  id: string;
  name: string;
  image: string | null;
  email: string;
  phone: string | null;
  tokenBalanceCents: number | null;
  orderCount: number;
  amountSpentCents: number | null;
  city: string | null;
  country: string | null;
  receiveMarketing: boolean;
  receiveSmsMarketing: boolean;
}

interface CustomersResponse {
  items: CustomerRow[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

function formatTokenBalance(cents: number | null): string {
  if (cents === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatOrderCount(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatAmountSpent(cents: number): string {
  if (cents === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const COLUMNS = [
  { key: "name", label: "Name", sortable: true as const },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email", sortable: true as const },
  { key: "location", label: "Location" },
  { key: "emailMarketing", label: "Email", title: "Email marketing" },
  { key: "smsMarketing", label: "SMS", title: "SMS marketing" },
  { key: "tokenBalance", label: "Token Balance", sortable: true as const },
  { key: "orderCount", label: "No Of Orders", sortable: true as const },
  { key: "amountSpent", label: "Amount spent", sortable: true as const },
  { key: "action", label: "Action" },
] as const;

type SortBy = "name" | "email" | "tokenBalance" | "orderCount" | "amountSpent";
type SortOrder = "asc" | "desc";

export default function AdminCustomersPage() {
  const [data, setData] = useState<CustomersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (search.trim()) params.set("search", search.trim());
      params.set("sortBy", sortBy);
      params.set("order", sortOrder);
      const res = await fetch(
        `${API_BASE}/api/admin/customers?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as CustomersResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, sortOrder]);

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

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
          onClick={() => void fetchCustomers()}
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
        <h2 className="text-2xl font-semibold tracking-tight">Customers</h2>
        <Link href="#">
          <Button type="button" className="gap-2">
            <Plus className="h-4 w-4" />+ Add Customer
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="sr-only">Customer list</CardTitle>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn(
                "w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm",
                "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
              )}
              placeholder="Search Customer..."
              type="text"
              autoComplete="off"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setSearch(searchInput);
                  setPage(1);
                }
              }}
              aria-label="Search customers"
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
                      {COLUMNS.map((col) => {
                        const isSortable =
                          "sortable" in col &&
                          col.sortable &&
                          (col.key === "name" ||
                            col.key === "email" ||
                            col.key === "tokenBalance" ||
                            col.key === "orderCount");
                        const isActive = isSortable && sortBy === col.key;
                        return (
                          <th
                            key={col.key}
                            className={cn(
                              "whitespace-nowrap p-4 font-medium",
                              (col.key === "tokenBalance" ||
                                col.key === "orderCount" ||
                                col.key === "amountSpent") &&
                                "text-right",
                              col.key === "action" && "text-right",
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
                            <span
                              className={cn(
                                "inline-flex items-center gap-1",
                                (col.key === "tokenBalance" ||
                                  col.key === "orderCount") &&
                                  "justify-end",
                              )}
                            >
                              {col.label}
                              {isSortable ? (
                                isActive ? (
                                  sortOrder === "asc" ? (
                                    <ChevronUp
                                      className="h-3.5 w-3.5 shrink-0 text-foreground"
                                      aria-hidden
                                    />
                                  ) : (
                                    <ChevronDown
                                      className="h-3.5 w-3.5 shrink-0 text-foreground"
                                      aria-hidden
                                    />
                                  )
                                ) : (
                                  <ArrowUpDown
                                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
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
                            ? "No customers match your search."
                            : "No customers yet."}
                        </td>
                      </tr>
                    ) : (
                      data.items.map((customer) => (
                        <tr
                          key={customer.id}
                          className="border-b last:border-0"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full border bg-muted">
                                {customer.image ? (
                                  <Image
                                    src={customer.image}
                                    alt=""
                                    fill
                                    className="object-cover"
                                    sizes="36px"
                                  />
                                ) : (
                                  <span
                                    className="flex size-full items-center justify-center text-xs font-medium text-muted-foreground"
                                    aria-hidden
                                  >
                                    {customer.name
                                      .trim()
                                      .slice(0, 1)
                                      .toUpperCase() || "?"}
                                  </span>
                                )}
                              </div>
                              <Link
                                href={`/customers/${customer.id}`}
                                className="font-medium text-primary underline-offset-2 hover:underline"
                              >
                                {customer.name}
                              </Link>
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {customer.phone ?? "—"}
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {customer.email}
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {[customer.city, customer.country]
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </td>
                          <td
                            className="p-4 text-center"
                            title="Email marketing"
                          >
                            {customer.receiveMarketing ? (
                              <span
                                className="inline-flex size-5 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                                aria-label="Agreed to email marketing"
                              >
                                ✓
                              </span>
                            ) : (
                              <span
                                className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground"
                                aria-label="Did not agree to email marketing"
                              >
                                —
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center" title="SMS marketing">
                            {customer.receiveSmsMarketing ? (
                              <span
                                className="inline-flex size-5 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                                aria-label="Agreed to SMS marketing"
                              >
                                ✓
                              </span>
                            ) : (
                              <span
                                className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground"
                                aria-label="Did not agree to SMS marketing"
                              >
                                —
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {formatTokenBalance(customer.tokenBalanceCents)}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {formatOrderCount(customer.orderCount)}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {formatAmountSpent(customer.amountSpentCents ?? 0)}
                          </td>
                          <td className="p-4 text-right">
                            <span className="inline-flex items-center gap-1">
                              <Link
                                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                href={`/customers/${customer.id}`}
                                aria-label={`Edit ${customer.name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                              <button
                                type="button"
                                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                aria-label={`Delete ${customer.name}`}
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
                    {Array.from(
                      { length: Math.min(5, data.totalPages) },
                      (_, i) => {
                        const start = Math.max(
                          1,
                          Math.min(data.page - 4, data.totalPages - 4),
                        );
                        const pageNum = Math.min(start + i, data.totalPages);
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
                      },
                    )}
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
