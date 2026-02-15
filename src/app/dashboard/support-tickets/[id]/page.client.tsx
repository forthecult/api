"use client";

import { ChevronLeft, Headphones, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { cn } from "~/lib/cn";
import { formatDateTime } from "~/lib/format";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/primitives/card";

interface Message {
  content: string;
  createdAt: string;
  id: string;
  role: "customer" | "staff";
  staffUser?: { firstName: string; image: null | string; lastName: string };
}

interface Ticket {
  createdAt: string;
  id: string;
  messages: Message[];
  status: string;
  subject: string;
  type: string;
  updatedAt: string;
}

export function SupportTicketDetailClient() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [ticket, setTicket] = React.useState<null | Ticket>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<null | string>(null);
  const [newMessage, setNewMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const fetchTicket = React.useCallback(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/support-tickets/${id}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load ticket");
        return res.json();
      })
      .then((data: Ticket) => {
        setTicket(data);
      })
      .catch(() => setError("Ticket not found"))
      .finally(() => setLoading(false));
  }, [id]);

  React.useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages]);

  const handleSendMessage = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const content = newMessage.trim();
      if (!content || !id || sending) return;
      setSending(true);
      fetch(`/api/support-tickets/${id}/messages`, {
        body: JSON.stringify({ content }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
        .then((res) => {
          if (!res.ok)
            return res
              .json()
              .then((b) =>
                Promise.reject(
                  new Error(
                    (b as { error?: string }).error ?? "Failed to send",
                  ),
                ),
              );
          return res.json() as Promise<Message>;
        })
        .then((msg) => {
          setNewMessage("");
          setTicket((prev) =>
            prev
              ? {
                  ...prev,
                  messages: [...prev.messages, msg],
                  updatedAt: msg.createdAt,
                }
              : prev,
          );
        })
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Failed to send"),
        )
        .finally(() => setSending(false));
    },
    [id, newMessage, sending],
  );

  const handleCloseTicket = React.useCallback(() => {
    if (!id || closing) return;
    setClosing(true);
    fetch(`/api/support-tickets/${id}`, {
      body: JSON.stringify({ status: "closed" }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    })
      .then((res) => {
        if (!res.ok)
          return res
            .json()
            .then((b) =>
              Promise.reject(
                new Error((b as { error?: string }).error ?? "Failed to close"),
              ),
            );
        return res.json() as Promise<{ status: string; updatedAt: string }>;
      })
      .then((data) => {
        setTicket((prev) =>
          prev
            ? { ...prev, status: data.status, updatedAt: data.updatedAt }
            : prev,
        );
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to close"),
      )
      .finally(() => setClosing(false));
  }, [id, closing]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2
          aria-hidden
          className="h-8 w-8 animate-spin text-muted-foreground"
        />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="space-y-6">
        <Button asChild className="gap-2" size="sm" variant="ghost">
          <Link href="/dashboard/support-tickets">
            <ChevronLeft className="h-4 w-4" />
            Back to tickets
          </Link>
        </Button>
        <p className="text-destructive">{error ?? "Ticket not found."}</p>
      </div>
    );
  }

  const canReply = ticket.status !== "closed";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          aria-label="Back to tickets"
          asChild
          size="icon"
          variant="ghost"
        >
          <Link href="/dashboard/support-tickets">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <Headphones className="h-7 w-7" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Support Ticket
        </h1>
      </div>

      <Card>
        <CardHeader
          className={`
          flex flex-col gap-2
          sm:flex-row sm:items-start sm:justify-between
        `}
        >
          <div>
            <CardTitle>{ticket.subject}</CardTitle>
            <p className="mt-1 text-base text-muted-foreground">
              Created {formatDateTime(ticket.createdAt)}
              {ticket.updatedAt !== ticket.createdAt && (
                <> · Updated {formatDateTime(ticket.updatedAt)}</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
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
                ticket.status === "closed" && "bg-muted text-muted-foreground",
              )}
            >
              {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
            </span>
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                ticket.type === "urgent"
                  ? `
                    bg-red-100 text-red-800
                    dark:bg-red-900/40 dark:text-red-200
                  `
                  : "bg-muted text-muted-foreground",
              )}
            >
              {ticket.type === "urgent" ? "Urgent" : "Normal"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <h3 className="text-base font-medium text-muted-foreground">
              Conversation
            </h3>
            <div
              className={`
              max-h-[400px] space-y-3 overflow-y-auto rounded-md border
              bg-muted/20 p-3
            `}
            >
              {ticket.messages.map((msg) => (
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 text-base",
                    msg.role === "customer"
                      ? "ml-6 bg-primary/10 text-foreground"
                      : "mr-6 bg-muted text-muted-foreground",
                  )}
                  key={msg.id}
                >
                  <span className="font-medium">
                    {msg.role === "staff" && msg.staffUser
                      ? [msg.staffUser.firstName, msg.staffUser.lastName]
                          .filter(Boolean)
                          .join(" ") || "Support"
                      : msg.role === "customer"
                        ? "You"
                        : "Support"}
                    :{" "}
                  </span>
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {formatDateTime(msg.createdAt)}
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {canReply ? (
            <form className="space-y-2" onSubmit={handleSendMessage}>
              <label className="text-base font-medium" htmlFor="new-message">
                Add a message
              </label>
              <div className="flex gap-2">
                <textarea
                  className={cn(
                    `
                      min-h-[80px] flex-1 resize-y rounded-md border
                      border-input bg-background px-3 py-2 text-sm
                    `,
                    `
                      placeholder:text-muted-foreground
                      focus:ring-2 focus:ring-ring focus:outline-none
                    `,
                  )}
                  disabled={sending}
                  id="new-message"
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message…"
                  rows={3}
                  value={newMessage}
                />
                <Button
                  className="shrink-0 self-end"
                  disabled={sending || !newMessage.trim()}
                  size="icon"
                  type="submit"
                >
                  <Send aria-hidden className="h-4 w-4" />
                  <span className="sr-only">Send</span>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                You can add more messages to this ticket. Support will reply
                here.
              </p>
              <Button
                disabled={closing}
                onClick={() => handleCloseTicket()}
                size="sm"
                type="button"
                variant="outline"
              >
                {closing ? "Closing…" : "Close ticket"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              This ticket is closed. Open a new ticket if you need further help.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
