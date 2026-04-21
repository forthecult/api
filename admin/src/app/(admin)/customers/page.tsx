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
  amountSpentCents: null | number;
  city: null | string;
  country: null | string;
  email: string;
  id: string;
  image: null | string;
  name: string;
  orderCount: number;
  phone: null | string;
  receiveMarketing: boolean;
  receiveSmsMarketing: boolean;
  tokenBalanceCents: null | number;
}

interface CustomersResponse {
  items: CustomerRow[];
  limit: number;
  page: number;
  totalCount: number;
  totalPages: number;
}

function formatAmountSpent(cents: number): string {
  if (cents === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(cents / 100);
}

function formatOrderCount(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatTokenBalance(cents: null | number): string {
  if (cents === null) return "—";
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
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

type SortBy = "amountSpent" | "email" | "name" | "orderCount" | "tokenBalance";
type SortOrder = "asc" | "desc";

export default function AdminCustomersPage() {
  const [data, setData] = useState<CustomersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "10", page: String(page) });
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
      <div
        className={`
          rounded-lg border border-red-200 bg-red-50 p-4 text-red-800
          dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
        `}
      >
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
      <div
        className={`
          flex flex-col gap-4
          sm:flex-row sm:items-center sm:justify-between
        `}
      >
        <h2 className="text-2xl font-semibold tracking-tight">Customers</h2>
        <Link href="#">
          <Button className="gap-2" type="button">
            <Plus className="h-4 w-4" />+ Add Customer
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
          <CardTitle className="sr-only">Customer list</CardTitle>
          <div className="relative max-w-md flex-1">
            <Search
              className={`
                absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2
                text-muted-foreground
              `}
            />
            <input
              aria-label="Search customers"
              autoComplete="off"
              className={cn(
                `
                  w-full rounded-md border border-input bg-background py-2 pr-3
                  pl-9 text-sm
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
              placeholder="Search Customer..."
              type="text"
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
                            aria-sort={
                              isActive
                                ? sortOrder === "asc"
                                  ? "ascending"
                                  : "descending"
                                : undefined
                            }
                            className={cn(
                              "p-4 font-medium whitespace-nowrap",
                              (col.key === "tokenBalance" ||
                                col.key === "orderCount" ||
                                col.key === "amountSpent") &&
                                "text-right",
                              col.key === "action" && "text-right",
                              isSortable &&
                                `
                                  cursor-pointer select-none
                                  hover:bg-muted/70
                                `,
                            )}
                            key={col.key}
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
                            scope="col"
                            tabIndex={isSortable ? 0 : undefined}
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
                                      aria-hidden
                                      className={`
                                        h-3.5 w-3.5 shrink-0 text-foreground
                                      `}
                                    />
                                  ) : (
                                    <ChevronDown
                                      aria-hidden
                                      className={`
                                        h-3.5 w-3.5 shrink-0 text-foreground
                                      `}
                                    />
                                  )
                                ) : (
                                  <ArrowUpDown
                                    aria-hidden
                                    className={`
                                      h-3.5 w-3.5 shrink-0 text-muted-foreground
                                    `}
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
                          className={`
                            border-b
                            last:border-0
                          `}
                          key={customer.id}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`
                                  relative flex h-9 w-9 shrink-0 overflow-hidden
                                  rounded-full border bg-muted
                                `}
                              >
                                {customer.image ? (
                                  <Image
                                    alt=""
                                    className="object-cover"
                                    fill
                                    sizes="36px"
                                    src={customer.image}
                                  />
                                ) : (
                                  <span
                                    aria-hidden
                                    className={`
                                      flex size-full items-center justify-center
                                      text-xs font-medium text-muted-foreground
                                    `}
                                  >
                                    {customer.name
                                      .trim()
                                      .slice(0, 1)
                                      .toUpperCase() || "?"}
                                  </span>
                                )}
                              </div>
                              <Link
                                className={`
                                  font-medium text-primary underline-offset-2
                                  hover:underline
                                `}
                                href={`/customers/${customer.id}`}
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
                                aria-label="Agreed to email marketing"
                                className={`
                                  inline-flex size-5 items-center justify-center
                                  rounded-full bg-green-100 text-green-700
                                  dark:bg-green-900/40 dark:text-green-400
                                `}
                              >
                                ✓
                              </span>
                            ) : (
                              <span
                                aria-label="Did not agree to email marketing"
                                className={`
                                  inline-flex size-5 items-center justify-center
                                  rounded-full bg-muted text-muted-foreground
                                `}
                              >
                                —
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center" title="SMS marketing">
                            {customer.receiveSmsMarketing ? (
                              <span
                                aria-label="Agreed to SMS marketing"
                                className={`
                                  inline-flex size-5 items-center justify-center
                                  rounded-full bg-green-100 text-green-700
                                  dark:bg-green-900/40 dark:text-green-400
                                `}
                              >
                                ✓
                              </span>
                            ) : (
                              <span
                                aria-label="Did not agree to SMS marketing"
                                className={`
                                  inline-flex size-5 items-center justify-center
                                  rounded-full bg-muted text-muted-foreground
                                `}
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
                                aria-label={`Edit ${customer.name}`}
                                className={`
                                  rounded p-1.5 text-muted-foreground
                                  transition-colors
                                  hover:bg-muted hover:text-foreground
                                `}
                                href={`/customers/${customer.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                              <button
                                aria-label={`Delete ${customer.name}`}
                                className={`
                                  rounded p-1.5 text-muted-foreground
                                  transition-colors
                                  hover:bg-destructive/10 hover:text-destructive
                                `}
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
                      },
                    )}
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
