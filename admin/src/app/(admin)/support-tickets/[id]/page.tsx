"use client";

import { ArrowLeft, Headphones } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE =
  typeof process.env.NEXT_PUBLIC_MAIN_APP_URL === "string"
    ? process.env.NEXT_PUBLIC_MAIN_APP_URL
    : "http://localhost:3000";

interface MessageRow {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  staffUser?: { firstName: string; lastName: string; image: string | null };
}

interface TicketDetail {
  id: string;
  subject: string;
  message: string;
  status: string;
  type: string; // "normal" | "urgent" (priority)
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; email: string };
  messages?: MessageRow[];
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

export default function AdminSupportTicketDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : null;
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const [priorityError, setPriorityError] = useState<string | null>(null);

  const fetchTicket = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/support-tickets/${id}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        if (res.status === 404) {
          setError("Ticket not found.");
          setTicket(null);
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as TicketDetail;
      setTicket(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ticket");
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchTicket();
  }, [fetchTicket]);

  const sendReply = useCallback(async () => {
    if (!id || !replyContent.trim()) return;
    setSending(true);
    setReplyError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/support-tickets/${id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content: replyContent.trim() }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setReplyContent("");
      void fetchTicket();
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSending(false);
    }
  }, [id, replyContent, fetchTicket]);

  const updateStatus = useCallback(
    async (status: "open" | "pending" | "closed") => {
      if (!id) return;
      setUpdatingStatus(true);
      setStatusError(null);
      try {
        const res = await fetch(
          `${API_BASE}/api/admin/support-tickets/${id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ status }),
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          updatedAt?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setTicket((prev) =>
          prev ? { ...prev, status, updatedAt: data.updatedAt ?? prev.updatedAt } : prev,
        );
      } catch (err) {
        setStatusError(err instanceof Error ? err.message : "Failed to update status");
      } finally {
        setUpdatingStatus(false);
      }
    },
    [id],
  );

  const updatePriority = useCallback(
    async (type: "normal" | "urgent") => {
      if (!id) return;
      setUpdatingPriority(true);
      setPriorityError(null);
      try {
        const res = await fetch(
          `${API_BASE}/api/admin/support-tickets/${id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ type }),
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          updatedAt?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setTicket((prev) =>
          prev ? { ...prev, type, updatedAt: data.updatedAt ?? prev.updatedAt } : prev,
        );
      } catch (err) {
        setPriorityError(err instanceof Error ? err.message : "Failed to update priority");
      } finally {
        setUpdatingPriority(false);
      }
    },
    [id],
  );

  if (!id) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
        Missing ticket id.
        <Link className="ml-2 underline" href="/support-tickets">
          Back to Support Tickets
        </Link>
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
          <Button
            className="mt-2"
            onClick={() => void fetchTicket()}
            type="button"
          >
            Retry
          </Button>
        </div>
        <Link
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          href="/support-tickets"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Support Tickets
        </Link>
      </div>
    );
  }

  if (loading && !ticket) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!ticket) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          href="/support-tickets"
          aria-label="Back to Support Tickets"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Headphones className="h-6 w-6" />
          <h2 className="text-2xl font-semibold tracking-tight">
            Support ticket
          </h2>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{ticket.subject}</CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <label htmlFor="ticket-status" className="sr-only">
                Ticket status
              </label>
              <select
                id="ticket-status"
                className="rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                disabled={updatingStatus}
                value={ticket.status}
                onChange={(e) => {
                  const v = e.target.value as "open" | "pending" | "closed";
                  if (v) void updateStatus(v);
                }}
              >
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="closed">Closed</option>
              </select>
            </span>
            <span className="flex items-center gap-2">
              <label htmlFor="ticket-priority" className="sr-only">
                Priority
              </label>
              <select
                id="ticket-priority"
                className="rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                disabled={updatingPriority}
                value={ticket.type === "urgent" ? "urgent" : "normal"}
                onChange={(e) => {
                  const v = e.target.value as "normal" | "urgent";
                  void updatePriority(v);
                }}
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </span>
            {statusError && (
              <span className="text-xs text-destructive">{statusError}</span>
            )}
            {priorityError && (
              <span className="text-xs text-destructive">{priorityError}</span>
            )}
            <span>Created {formatDate(ticket.createdAt)}</span>
            {ticket.updatedAt !== ticket.createdAt && (
              <span>Updated {formatDate(ticket.updatedAt)}</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {(ticket.messages?.length ?? 0) > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                Conversation
              </h3>
              <div className="max-h-[400px] space-y-2 overflow-y-auto rounded-md border bg-muted/20 p-3">
                {ticket.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm",
                      msg.role === "customer"
                        ? "ml-6 bg-primary/10 text-foreground"
                        : "mr-6 bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100",
                    )}
                  >
                    <span className="font-medium">
                      {msg.role === "staff" && msg.staffUser
                        ? [msg.staffUser.firstName, msg.staffUser.lastName].filter(Boolean).join(" ") || "Staff"
                        : msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}
                      :{" "}
                    </span>
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatDate(msg.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                Message
              </h3>
              <p className="whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm">
                {ticket.message}
              </p>
            </div>
          )}

          {ticket.status !== "closed" && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                Reply
              </h3>
              <div className="space-y-2">
                <textarea
                  className="min-h-[120px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={sending}
                  placeholder="Type your reply to the customer…"
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                />
                {replyError && (
                  <p className="text-sm text-destructive">{replyError}</p>
                )}
                <Button
                  disabled={sending || !replyContent.trim()}
                  onClick={() => void sendReply()}
                  type="button"
                >
                  {sending ? "Sending…" : "Send reply"}
                </Button>
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Customer
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/customers/${ticket.customer.id}`}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {ticket.customer.name || "—"}
              </Link>
              <span className="text-muted-foreground">
                {ticket.customer.email}
              </span>
              <Link
                href={`/customers/${ticket.customer.id}`}
                className="text-sm text-primary underline-offset-2 hover:underline"
              >
                View customer →
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
