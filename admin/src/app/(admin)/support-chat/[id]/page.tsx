"use client";

import { ArrowLeft, HandHelping } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  staffUser?: { firstName: string; lastName: string; image: string | null };
}

interface OrderSummary {
  id: string;
  email: string;
  status: string;
  paymentStatus?: string;
  totalCents: number;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  status: string;
  takenOverBy?: string;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; email: string } | null;
  guestId?: string;
  messages: Message[];
  orders: OrderSummary[];
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

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default function AdminSupportChatDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : null;
  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffInput, setStaffInput] = useState("");
  const [sending, setSending] = useState(false);
  const [takingOver, setTakingOver] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversation = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/support-chat/conversations/${id}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ConversationDetail;
      setConv(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chat");
      setConv(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchConversation();
  }, [fetchConversation]);

  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => void fetchConversation(), 5_000);
    return () => clearInterval(interval);
  }, [id, fetchConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv?.messages]);

  const handleTakeover = useCallback(async () => {
    if (!id) return;
    setTakingOver(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/support-chat/conversations/${id}/takeover`,
        { method: "POST", credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to take over");
      }
      await fetchConversation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Takeover failed");
    } finally {
      setTakingOver(false);
    }
  }, [id, fetchConversation]);

  const updateStatus = useCallback(
    async (status: "open" | "closed") => {
      if (!id) return;
      setUpdatingStatus(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/admin/support-chat/conversations/${id}`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { status: string; updatedAt: string };
        setConv((prev) =>
          prev
            ? { ...prev, status: data.status, updatedAt: data.updatedAt }
            : prev,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update status");
      } finally {
        setUpdatingStatus(false);
      }
    },
    [id],
  );

  const handleSendStaffMessage = useCallback(async () => {
    const text = staffInput.trim();
    if (!text || !id) return;
    setSending(true);
    setStaffInput("");
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/support-chat/conversations/${id}/messages`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to send");
      }
      await fetchConversation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }, [id, staffInput, fetchConversation]);

  if (!id) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
        Missing conversation id.
        <Link className="ml-2 underline" href="/support-chat">
          Back to Support Chat
        </Link>
      </div>
    );
  }

  if (error && !conv) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
          <Button className="mt-2" onClick={() => void fetchConversation()} type="button">
            Retry
          </Button>
        </div>
        <Link className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" href="/support-chat">
          <ArrowLeft className="h-4 w-4" /> Back to Support Chat
        </Link>
      </div>
    );
  }

  if (loading && !conv) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!conv) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            href="/support-chat"
            aria-label="Back to Support Chat"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h2 className="text-2xl font-semibold tracking-tight">
            Chat {conv.id.slice(0, 8)}…
          </h2>
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                conv.status === "open" &&
                  "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
                conv.status === "closed" &&
                  "bg-muted text-muted-foreground",
              )}
            >
              {conv.status}
            </span>
            <label htmlFor="chat-status" className="sr-only">
              Chat status
            </label>
            <select
              id="chat-status"
              className="rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              disabled={updatingStatus}
              value={conv.status}
              onChange={(e) => {
                const v = e.target.value as "open" | "closed";
                if (v) void updateStatus(v);
              }}
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </span>
        </div>
        {!conv.takenOverBy && (
          <Button
            type="button"
            variant="default"
            onClick={() => void handleTakeover()}
            disabled={takingOver}
            className="inline-flex items-center gap-2"
          >
            <HandHelping className="h-4 w-4" />
            Take over from AI
          </Button>
        )}
        {conv.takenOverBy && (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
            You are replying as staff
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Messages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[400px] overflow-y-auto space-y-3 rounded-md border bg-muted/30 p-3">
                {conv.messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet.</p>
                ) : (
                  conv.messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm",
                        m.role === "customer" &&
                          "ml-8 bg-primary/10 text-foreground",
                        m.role === "ai" &&
                          "mr-8 bg-muted text-muted-foreground",
                        m.role === "staff" &&
                          "mr-8 bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100",
                      )}
                    >
                      <span className="font-medium">
                        {m.role === "staff" && m.staffUser
                          ? [m.staffUser.firstName, m.staffUser.lastName].filter(Boolean).join(" ") || "Staff"
                          : m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                        :{" "}
                      </span>
                      {m.content}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatDate(m.createdAt)}
                      </span>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex gap-2">
                <input
                  className={cn(
                    "flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm",
                    "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                  )}
                  placeholder="Reply as staff…"
                  value={staffInput}
                  onChange={(e) => setStaffInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendStaffMessage();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => void handleSendStaffMessage()}
                  disabled={sending || !staffInput.trim()}
                >
                  {sending ? "Sending…" : "Send"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent>
              {conv.customer ? (
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{conv.customer.name || "—"}</p>
                  <p className="text-muted-foreground">{conv.customer.email}</p>
                  <Link
                    href={`/customers/${conv.customer.id}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    View customer →
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Guest {conv.guestId ? `(${conv.guestId.slice(0, 8)}…)` : ""}
                </p>
              )}
            </CardContent>
          </Card>

          {conv.customer && conv.orders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent orders</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {conv.orders.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0">
                      <Link
                        href={`/orders/${o.id}`}
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {o.id.slice(0, 8)}…
                      </Link>
                      <span className="text-muted-foreground">
                        {formatCents(o.totalCents)}
                      </span>
                      <span className="w-full text-xs text-muted-foreground">
                        {o.paymentStatus ?? o.status} · {formatDate(o.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
