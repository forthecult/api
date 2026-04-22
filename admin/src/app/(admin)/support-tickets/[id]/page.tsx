"use client";

import { ArrowLeft, Headphones } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getAdminApiBaseUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getAdminApiBaseUrl();

interface MessageRow {
  content: string;
  createdAt: string;
  id: string;
  role: string;
  staffUser?: { firstName: string; image: null | string; lastName: string };
}

interface TicketDetail {
  createdAt: string;
  customer: { email: string; id: string; name: string };
  id: string;
  message: string;
  messages?: MessageRow[];
  status: string;
  subject: string;
  type: string; // "normal" | "urgent" (priority)
  updatedAt: string;
}

export default function AdminSupportTicketDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : null;
  const [ticket, setTicket] = useState<null | TicketDetail>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
  const [replyContent, setReplyContent] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<null | string>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<null | string>(null);
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const [priorityError, setPriorityError] = useState<null | string>(null);

  const fetchTicket = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/support-tickets/${id}`, {
        credentials: "include",
      });
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
          body: JSON.stringify({ content: replyContent.trim() }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
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
      setReplyError(
        err instanceof Error ? err.message : "Failed to send reply",
      );
    } finally {
      setSending(false);
    }
  }, [id, replyContent, fetchTicket]);

  const updateStatus = useCallback(
    async (status: "closed" | "open" | "pending") => {
      if (!id) return;
      setUpdatingStatus(true);
      setStatusError(null);
      try {
        const res = await fetch(`${API_BASE}/api/admin/support-tickets/${id}`, {
          body: JSON.stringify({ status }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          updatedAt?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setTicket((prev) =>
          prev
            ? { ...prev, status, updatedAt: data.updatedAt ?? prev.updatedAt }
            : prev,
        );
      } catch (err) {
        setStatusError(
          err instanceof Error ? err.message : "Failed to update status",
        );
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
        const res = await fetch(`${API_BASE}/api/admin/support-tickets/${id}`, {
          body: JSON.stringify({ type }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          updatedAt?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setTicket((prev) =>
          prev
            ? { ...prev, type, updatedAt: data.updatedAt ?? prev.updatedAt }
            : prev,
        );
      } catch (err) {
        setPriorityError(
          err instanceof Error ? err.message : "Failed to update priority",
        );
      } finally {
        setUpdatingPriority(false);
      }
    },
    [id],
  );

  if (!id) {
    return (
      <div
        className={`
          rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800
          dark:bg-amber-900/20 dark:text-amber-200
        `}
      >
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
        <div
          className={`
            rounded-lg border border-red-200 bg-red-50 p-4 text-red-800
            dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
          `}
        >
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
          className={`
            inline-flex items-center gap-1 text-sm text-muted-foreground
            hover:text-foreground
          `}
          href="/support-tickets"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Support Tickets
        </Link>
      </div>
    );
  }

  if (loading && !ticket) {
    return (
      <div
        className={`
          flex min-h-[200px] items-center justify-center text-muted-foreground
        `}
      >
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
          aria-label="Back to Support Tickets"
          className={`
            rounded p-1.5 text-muted-foreground
            hover:bg-muted hover:text-foreground
          `}
          href="/support-tickets"
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
          <div
            className={`
              flex flex-wrap items-center gap-2 text-sm text-muted-foreground
            `}
          >
            <span className="flex items-center gap-2">
              <label className="sr-only" htmlFor="ticket-status">
                Ticket status
              </label>
              <select
                className={`
                  rounded-md border border-input bg-background px-2.5 py-1
                  text-xs font-medium
                  focus:ring-2 focus:ring-ring focus:outline-none
                  disabled:opacity-50
                `}
                disabled={updatingStatus}
                id="ticket-status"
                onChange={(e) => {
                  const v = e.target.value as "closed" | "open" | "pending";
                  if (v) void updateStatus(v);
                }}
                value={ticket.status}
              >
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="closed">Closed</option>
              </select>
            </span>
            <span className="flex items-center gap-2">
              <label className="sr-only" htmlFor="ticket-priority">
                Priority
              </label>
              <select
                className={`
                  rounded-md border border-input bg-background px-2.5 py-1
                  text-xs font-medium
                  focus:ring-2 focus:ring-ring focus:outline-none
                  disabled:opacity-50
                `}
                disabled={updatingPriority}
                id="ticket-priority"
                onChange={(e) => {
                  const v = e.target.value as "normal" | "urgent";
                  void updatePriority(v);
                }}
                value={ticket.type === "urgent" ? "urgent" : "normal"}
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
              <div
                className={`
                  max-h-[400px] space-y-2 overflow-y-auto rounded-md border
                  bg-muted/20 p-3
                `}
              >
                {(ticket.messages ?? []).map((msg) => (
                  <div
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm",
                      msg.role === "customer"
                        ? "ml-6 bg-primary/10 text-foreground"
                        : `
                          mr-6 bg-blue-100 text-blue-900
                          dark:bg-blue-900/40 dark:text-blue-100
                        `,
                    )}
                    key={msg.id}
                  >
                    <span className="font-medium">
                      {msg.role === "staff" && msg.staffUser
                        ? [msg.staffUser.firstName, msg.staffUser.lastName]
                            .filter(Boolean)
                            .join(" ") || "Staff"
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
              <p
                className={`
                  rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap
                `}
              >
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
                  className={`
                    min-h-[120px] w-full resize-y rounded-md border border-input
                    bg-background px-3 py-2 text-sm ring-offset-background
                    placeholder:text-muted-foreground
                    focus-visible:ring-2 focus-visible:ring-ring
                    focus-visible:ring-offset-2 focus-visible:outline-none
                    disabled:cursor-not-allowed disabled:opacity-50
                  `}
                  disabled={sending}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Type your reply to the customer…"
                  value={replyContent}
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
                className={`
                  font-medium text-primary underline-offset-2
                  hover:underline
                `}
                href={`/customers/${ticket.customer.id}`}
              >
                {ticket.customer.name || "—"}
              </Link>
              <span className="text-muted-foreground">
                {ticket.customer.email}
              </span>
              <Link
                className={`
                  text-sm text-primary underline-offset-2
                  hover:underline
                `}
                href={`/customers/${ticket.customer.id}`}
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
