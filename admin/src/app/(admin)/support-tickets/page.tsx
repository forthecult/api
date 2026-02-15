"use client";

import {
  ChevronLeft,
  ChevronRight,
  Headphones,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

interface TicketRow {
  id: string;
  subject: string;
  message: string;
  status: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    email: string;
  };
}

interface SupportTicketsResponse {
  items: TicketRow[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

function formatDate(s: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(s));
  } catch {
    return "—";
  }
}

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "closed", label: "Closed" },
] as const;

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
] as const;

export default function AdminSupportTicketsPage() {
  const router = useRouter();
  const [data, setData] = useState<SupportTicketsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (statusFilter.trim()) params.set("status", statusFilter.trim());
      if (typeFilter.trim()) params.set("type", typeFilter.trim());
      if (fromDate.trim()) params.set("fromDate", fromDate.trim());
      if (toDate.trim()) params.set("toDate", toDate.trim());
      const res = await fetch(
        `${API_BASE}/api/admin/support-tickets?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as SupportTicketsResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, fromDate, toDate]);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
        {error}
        <Button
          className="mt-2"
          onClick={() => void fetchTickets()}
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
        <div className="flex items-center gap-2">
          <Headphones className="h-7 w-7" />
          <h2 className="text-2xl font-semibold tracking-tight">
            Support Tickets
          </h2>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="sr-only">Support ticket list</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="statusFilter" className="text-sm font-medium">
              Status
            </label>
            <select
              id="statusFilter"
              className={cn(
                "rounded-md border border-input bg-background px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring",
              )}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by ticket status"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              id="typeFilter"
              className={cn(
                "rounded-md border border-input bg-background px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring",
              )}
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by ticket type"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <label htmlFor="fromDate" className="text-sm font-medium">
              From date
            </label>
            <input
              id="fromDate"
              type="date"
              className={cn(
                "rounded-md border border-input bg-background px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring",
              )}
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              aria-label="Filter from date"
            />
            <label htmlFor="toDate" className="text-sm font-medium">
              To date
            </label>
            <input
              id="toDate"
              type="date"
              className={cn(
                "rounded-md border border-input bg-background px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring",
              )}
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              aria-label="Filter to date"
            />
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={cn(
                  "w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm",
                  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                )}
                placeholder="Search ticket..."
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setPage(1);
                  }
                }}
                aria-label="Search tickets"
              />
            </div>
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
                      <th
                        scope="col"
                        className="whitespace-nowrap p-4 font-medium"
                      >
                        Customer
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap p-4 font-medium"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap p-4 font-medium"
                      >
                        Type
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap p-4 font-medium"
                      >
                        Subject
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap p-4 font-medium"
                      >
                        Ticket date
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap p-4 font-medium text-right"
                      >
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.length === 0 ? (
                      <tr>
                        <td
                          className="p-8 text-center text-muted-foreground"
                          colSpan={6}
                        >
                          {statusFilter || typeFilter || fromDate || toDate
                            ? "No tickets match the selected filters."
                            : "No support tickets yet."}
                        </td>
                      </tr>
                    ) : (
                      data.items.map((ticket) => (
                        <tr
                          key={ticket.id}
                          role="button"
                          tabIndex={0}
                          className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() =>
                            router.push(`/support-tickets/${ticket.id}`)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              router.push(`/support-tickets/${ticket.id}`);
                            }
                          }}
                        >
                          <td
                            className="p-4"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex flex-col">
                              <Link
                                href={`/customers/${ticket.customer.id}`}
                                className="font-medium text-primary underline-offset-2 hover:underline"
                              >
                                {ticket.customer.name || "—"}
                              </Link>
                              <span className="text-xs text-muted-foreground">
                                {ticket.customer.email}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                                ticket.status === "open" &&
                                  "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
                                ticket.status === "pending" &&
                                  "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
                                ticket.status === "closed" &&
                                  "bg-muted text-muted-foreground",
                              )}
                            >
                              {ticket.status.charAt(0).toUpperCase() +
                                ticket.status.slice(1)}
                            </span>
                          </td>
                          <td className="p-4">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                                ticket.type === "urgent"
                                  ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {ticket.type === "urgent" ? "Urgent" : "Normal"}
                            </span>
                          </td>
                          <td
                            className="max-w-[200px] truncate p-4"
                            title={ticket.subject}
                          >
                            {ticket.subject}
                          </td>
                          <td className="whitespace-nowrap p-4 text-muted-foreground">
                            {formatDate(ticket.createdAt)}
                          </td>
                          <td
                            className="p-4 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="inline-flex items-center gap-1">
                              <Link
                                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                href={`/support-tickets/${ticket.id}`}
                                aria-label={`View ticket ${ticket.subject}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                              <button
                                type="button"
                                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                aria-label={`Delete ticket ${ticket.subject}`}
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

              {data.items.length > 0 && data.totalPages > 1 && (
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
                  <span className="text-sm text-muted-foreground">
                    Page {data.page} of {data.totalPages}
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
