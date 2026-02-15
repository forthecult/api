"use client";

import { ChevronRight, Headphones, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { useCurrentUser } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import { formatDate } from "~/lib/format";
import { DASHBOARD_COUNTS_INVALIDATE } from "~/ui/components/dashboard-sidebar";
import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

interface Ticket {
  createdAt: string;
  id: string;
  message: string;
  status: string;
  subject: string;
  type: string;
  updatedAt: string;
}

export function SupportTicketsPageClient() {
  const { user } = useCurrentUser();
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showNewForm, setShowNewForm] = React.useState(false);
  const [newSubject, setNewSubject] = React.useState("");
  const [newMessage, setNewMessage] = React.useState("");
  const [newType, setNewType] = React.useState<"normal" | "urgent">("normal");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<null | string>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState<null | string>(null);
  const [deletingId, setDeletingId] = React.useState<null | string>(null);

  const fetchTickets = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch("/api/support-tickets", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load tickets");
      const data = (await res.json()) as { tickets: Ticket[] };
      setTickets(data.tickets ?? []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/support-tickets", {
        body: JSON.stringify({
          message: newMessage.trim(),
          subject: newSubject.trim(),
          type: newType,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
        retryAfterSeconds?: number;
      };
      if (!res.ok) {
        let msg = json.error ?? "Failed to create ticket.";
        if (res.status === 429 && json.retryAfterSeconds != null) {
          const mins = Math.ceil(json.retryAfterSeconds / 60);
          const base = msg.trim().replace(/\.$/, "");
          msg = base.includes("Update your current ticket")
            ? `${base} Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`
            : `${base} Update your current ticket if you have new information, or try again in ${mins} minute${mins !== 1 ? "s" : ""}.`;
        }
        setSubmitError(msg);
        return;
      }
      setSubmitSuccess("Ticket created. We'll get back to you soon.");
      setNewSubject("");
      setNewMessage("");
      setNewType("normal");
      setShowNewForm(false);
      void fetchTickets();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, ticketId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this support ticket? This cannot be undone.")) return;
    setDeletingId(ticketId);
    try {
      const res = await fetch(`/api/support-tickets/${ticketId}`, {
        credentials: "include",
        method: "DELETE",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        alert(json.error ?? "Failed to delete ticket.");
        return;
      }
      void fetchTickets();
      window.dispatchEvent(new CustomEvent(DASHBOARD_COUNTS_INVALIDATE));
    } finally {
      setDeletingId(null);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">
          Please sign in to view support tickets.
        </p>
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
          <Headphones className="h-7 w-7" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Support Tickets
          </h1>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            setShowNewForm((v) => !v);
            setSubmitError(null);
            setSubmitSuccess(null);
          }}
          type="button"
          variant={showNewForm ? "secondary" : "default"}
        >
          <Plus className="h-4 w-4" />
          {showNewForm ? "Cancel" : "New ticket"}
        </Button>
      </div>

      {showNewForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create a ticket</CardTitle>
            <CardDescription>
              Describe your issue. We&apos;ll respond as soon as we can.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  maxLength={500}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g. Order not arrived"
                  required
                  type="text"
                  value={newSubject}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Priority</Label>
                <select
                  className={cn(
                    `
                      flex h-10 w-full rounded-md border border-input
                      bg-background px-3 py-2 text-sm
                    `,
                    `
                      ring-offset-background
                      focus-visible:ring-2 focus-visible:ring-ring
                      focus-visible:outline-none
                    `,
                  )}
                  id="type"
                  onChange={(e) =>
                    setNewType(e.target.value as "normal" | "urgent")
                  }
                  value={newType}
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <textarea
                  className={cn(
                    `
                      flex min-h-[100px] w-full rounded-md border border-input
                      bg-transparent px-3 py-2 text-sm
                    `,
                    `
                      placeholder:text-muted-foreground
                      focus-visible:ring-2 focus-visible:ring-ring
                      focus-visible:outline-none
                    `,
                    "resize-none",
                  )}
                  id="message"
                  maxLength={10000}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Describe your issue in detail..."
                  required
                  rows={4}
                  value={newMessage}
                />
              </div>
              {submitError && (
                <p className="text-sm text-destructive" role="alert">
                  {submitError}
                </p>
              )}
              {submitSuccess && (
                <p
                  className={`
                    text-sm text-green-600
                    dark:text-green-400
                  `}
                  role="status"
                >
                  {submitSuccess}
                </p>
              )}
              <Button disabled={submitting} type="submit">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit ticket"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your tickets</CardTitle>
          <CardDescription>
            View and track your support requests.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div
              className={`
              flex min-h-[120px] items-center justify-center
              text-muted-foreground
            `}
            >
              <Loader2 aria-hidden className="h-6 w-6 animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No support tickets yet. Open a new ticket above if you need help.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <div
                    className={cn(
                      `
                        flex flex-wrap items-center gap-3 py-4 pr-2
                        transition-colors
                        hover:bg-muted/50
                      `,
                      "sm:flex-nowrap",
                    )}
                  >
                    <Link
                      className="min-w-0 flex-1"
                      href={`/dashboard/support-tickets/${ticket.id}`}
                    >
                      <p className="truncate font-medium">{ticket.subject}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(ticket.createdAt)}
                        <span className="mx-2">·</span>
                        {ticket.type === "urgent" ? "Urgent" : "Normal"}
                      </p>
                    </Link>
                    <span
                      className={cn(
                        `
                          inline-flex shrink-0 rounded-full px-2.5 py-0.5
                          text-xs font-medium
                        `,
                        ticket.status === "open" &&
                          `
                            bg-green-100 text-green-800
                            dark:bg-green-900/40 dark:text-green-200
                          `,
                        ticket.status === "pending" &&
                          `
                            bg-amber-100 text-amber-800
                            dark:bg-amber-900/40 dark:text-amber-200
                          `,
                        ticket.status === "closed" &&
                          "bg-muted text-muted-foreground",
                      )}
                    >
                      {ticket.status.charAt(0).toUpperCase() +
                        ticket.status.slice(1)}
                    </span>
                    <Button
                      aria-label={`Delete ticket ${ticket.subject}`}
                      className={`
                        h-8 w-8 shrink-0 text-muted-foreground
                        hover:text-destructive
                      `}
                      disabled={deletingId === ticket.id}
                      onClick={(e) => void handleDelete(e, ticket.id)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      {deletingId === ticket.id ? (
                        <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 aria-hidden className="h-4 w-4" />
                      )}
                    </Button>
                    <Link
                      aria-label={`View ticket ${ticket.subject}`}
                      className={`
                        shrink-0 text-muted-foreground
                        hover:text-foreground
                      `}
                      href={`/dashboard/support-tickets/${ticket.id}`}
                    >
                      <ChevronRight aria-hidden className="h-4 w-4" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
