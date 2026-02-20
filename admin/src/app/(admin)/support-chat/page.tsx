"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

interface ChatRow {
  createdAt: string;
  customer: { email: null | string; id: null | string; name: string };
  guestId?: string;
  id: string;
  lastMessageAt: null | string;
  lastMessageRole: null | string;
  source?: string;
  status: string;
  takenOverBy: null | string;
  updatedAt: string;
}

interface SupportChatListResponse {
  items: ChatRow[];
  limit: number;
  page: number;
  totalCount: number;
  totalPages: number;
}

export default function AdminSupportChatPage() {
  const [data, setData] = useState<null | SupportChatListResponse>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
  const [page, setPage] = useState(1);
  const [widgetVisible, setWidgetVisible] = useState<boolean>(true);
  const [widgetToggleLoading, setWidgetToggleLoading] = useState(false);

  const fetchWidgetVisible = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/support-chat/widget-visible`,
        {
          credentials: "include",
        },
      );
      if (res.ok) {
        const json = (await res.json()) as { visible?: boolean };
        setWidgetVisible(json.visible !== false);
      }
    } catch {
      // keep default true
    }
  }, []);

  const setWidgetVisibleToggle = useCallback(async (visible: boolean) => {
    setWidgetToggleLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/support-chat/widget-visible`,
        {
          body: JSON.stringify({ visible }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        },
      );
      if (res.ok) {
        setWidgetVisible(visible);
      }
    } catch {
      // ignore
    } finally {
      setWidgetToggleLoading(false);
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "20", page: String(page) });
      const res = await fetch(
        `${API_BASE}/api/admin/support-chat/conversations?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as SupportChatListResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chats");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    void fetchWidgetVisible();
  }, [fetchWidgetVisible]);

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
          onClick={() => void fetchConversations()}
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
        <div className="flex items-center gap-2">
          <MessageCircle className="h-7 w-7" />
          <h2 className="text-2xl font-semibold tracking-tight">
            Support Chat
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Chat widget on storefront
          </span>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              checked={widgetVisible}
              className="size-4 rounded border-input"
              disabled={widgetToggleLoading}
              onChange={(e) => setWidgetVisibleToggle(e.target.checked)}
              type="checkbox"
            />
            <span className="text-sm font-medium">
              {widgetVisible ? "Visible" : "Hidden"}
            </span>
          </label>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="sr-only">Support chat conversations</CardTitle>
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
                      <th
                        className="p-4 font-medium whitespace-nowrap"
                        scope="col"
                      >
                        Customer
                      </th>
                      <th
                        className="p-4 font-medium whitespace-nowrap"
                        scope="col"
                      >
                        Source
                      </th>
                      <th
                        className="p-4 font-medium whitespace-nowrap"
                        scope="col"
                      >
                        Status
                      </th>
                      <th
                        className="p-4 font-medium whitespace-nowrap"
                        scope="col"
                      >
                        Mode
                      </th>
                      <th
                        className="p-4 font-medium whitespace-nowrap"
                        scope="col"
                      >
                        Updated
                      </th>
                      <th
                        className="p-4 text-right font-medium whitespace-nowrap"
                        scope="col"
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
                          No support chat conversations yet.
                        </td>
                      </tr>
                    ) : (
                      data.items.map((row) => (
                        <tr
                          className={`
                          border-b
                          last:border-0
                        `}
                          key={row.id}
                        >
                          <td className="p-4">
                            <div className="flex flex-col">
                              {row.customer.id ? (
                                <>
                                  <Link
                                    className={`
                                      font-medium text-primary
                                      underline-offset-2
                                      hover:underline
                                    `}
                                    href={`/customers/${row.customer.id}`}
                                  >
                                    {row.customer.name || "—"}
                                  </Link>
                                  <span
                                    className={`
                                    text-xs text-muted-foreground
                                  `}
                                  >
                                    {row.customer.email ?? "—"}
                                  </span>
                                </>
                              ) : (
                                <span className="text-muted-foreground">
                                  Guest{" "}
                                  {row.guestId
                                    ? `(${row.guestId.slice(0, 8)}…)`
                                    : ""}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <span
                              className={cn(
                                "text-xs font-medium",
                                row.source === "mobile" &&
                                  "text-blue-600 dark:text-blue-400",
                              )}
                            >
                              {row.source === "mobile" ? "Mobile app" : "Web"}
                            </span>
                          </td>
                          <td className="p-4">
                            <span
                              className={cn(
                                `
                                  inline-flex rounded-full px-2.5 py-0.5 text-xs
                                  font-medium
                                `,
                                row.status === "open" &&
                                  `
                                    bg-amber-100 text-amber-800
                                    dark:bg-amber-900/40 dark:text-amber-200
                                  `,
                                row.status === "closed" &&
                                  "bg-muted text-muted-foreground",
                              )}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="p-4">
                            {row.takenOverBy ? (
                              <span
                                className={`
                                text-xs font-medium text-blue-600
                                dark:text-blue-400
                              `}
                              >
                                Human
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                AI
                              </span>
                            )}
                          </td>
                          <td
                            className={`
                            p-4 whitespace-nowrap text-muted-foreground
                          `}
                          >
                            {formatDate(row.updatedAt)}
                          </td>
                          <td className="p-4 text-right">
                            <Link
                              aria-label={`Open chat ${row.id}`}
                              className={`
                                inline-flex rounded p-1.5 text-muted-foreground
                                transition-colors
                                hover:bg-muted hover:text-foreground
                              `}
                              href={`/support-chat/${row.id}`}
                            >
                              Open
                            </Link>
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
                    ←
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
                    →
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
