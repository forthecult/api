"use client";

import React from "react";
import { usePathname } from "next/navigation";

import { cn } from "~/lib/cn";
import { Button } from "~/ui/primitives/button";
import { Input } from "~/ui/primitives/input";

const GUEST_ID_KEY = "support-chat-guest-id";
const POLL_INTERVAL_MS = 3_000;
const API_BASE = "";

function getGuestId(): string | null {
  if (typeof window === "undefined") return null;
  let id = sessionStorage.getItem(GUEST_ID_KEY);
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    id = crypto.randomUUID();
    sessionStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

function getHeaders(guestId: string | null): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (guestId) h["X-Support-Guest-Id"] = guestId;
  return h;
}

type Message = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

type Conversation = {
  id: string;
  status: string;
  takenOverBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export function SupportChatWidget() {
  const pathname = usePathname();
  const isCheckout = pathname?.startsWith("/checkout") ?? false;
  const [open, setOpen] = React.useState(false);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [takenOverBy, setTakenOverBy] = React.useState<string | null>(null);
  const guestIdRef = React.useRef<string | null>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchConversations = React.useCallback(async () => {
    const guestId = getGuestId();
    guestIdRef.current = guestId;
    const res = await fetch(`${API_BASE}/api/support-chat/conversations`, {
      credentials: "include",
      headers: getHeaders(guestId),
    });
    if (!res.ok) {
      if (res.status === 401) return [];
      return [];
    }
    const data = (await res.json()) as { conversations?: Conversation[] };
    return data.conversations ?? [];
  }, []);

  const ensureConversation = React.useCallback(async () => {
    const list = await fetchConversations();
    if (list.length > 0) {
      setConversationId(list[0]!.id);
      return list[0]!.id;
    }
    const guestId = getGuestId();
    const res = await fetch(`${API_BASE}/api/support-chat/conversations`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(guestId),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setError(err.error ?? "Could not start chat.");
      return null;
    }
    const conv = (await res.json()) as { id: string };
    setConversationId(conv.id);
    return conv.id;
  }, [fetchConversations]);

  const fetchMessages = React.useCallback(async (cid: string) => {
    const guestId = getGuestId();
    const res = await fetch(
      `${API_BASE}/api/support-chat/conversations/${cid}/messages`,
      { credentials: "include", headers: getHeaders(guestId) },
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      messages?: Message[];
      takenOverBy?: string;
    };
    setMessages(data.messages ?? []);
    setTakenOverBy(data.takenOverBy ?? null);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const cid = conversationId ?? (await ensureConversation());
      if (cancelled || !cid) return;
      await fetchMessages(cid);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, conversationId, ensureConversation, fetchMessages]);

  React.useEffect(() => {
    if (!open || !conversationId) return;
    const id = setInterval(() => {
      fetchMessages(conversationId);
    }, POLL_INTERVAL_MS);
    pollRef.current = id;
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [open, conversationId, fetchMessages]);

  const sendMessage = React.useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setError(null);
    let cid = conversationId;
    if (!cid) {
      setLoading(true);
      cid = await ensureConversation();
      if (!cid) {
        setLoading(false);
        return;
      }
      setConversationId(cid);
    }
    setInput("");
    setLoading(true);
    const guestId = getGuestId();
    try {
      const res = await fetch(
        `${API_BASE}/api/support-chat/conversations/${cid}/messages`,
        {
          method: "POST",
          credentials: "include",
          headers: getHeaders(guestId),
          body: JSON.stringify({ content: text }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        messages?: Message[];
        error?: string;
        takenOverBy?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Failed to send.");
        return;
      }
      setMessages(data.messages ?? []);
      setTakenOverBy(data.takenOverBy ?? null);
    } finally {
      setLoading(false);
    }
  }, [input, conversationId, ensureConversation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  if (isCheckout) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div
          className={cn(
            "relative z-10 flex w-[min(100vw-2rem,380px)] flex-col rounded-lg border bg-background shadow-lg",
            "max-h-[min(70vh,420px)] overflow-hidden",
          )}
        >
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-medium">
              {takenOverBy ? "Support" : "Chat"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
              className="h-8 w-8 p-0"
            >
              ×
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {messages.length === 0 && !loading && !error && (
              <p className="text-muted-foreground text-sm">
                Say hello. We&apos;ll reply shortly.
              </p>
            )}
            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}
            <ul className="space-y-2">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-sm",
                    m.role === "customer"
                      ? "ml-8 bg-primary text-primary-foreground"
                      : "mr-8 bg-muted",
                  )}
                >
                  <span className="font-medium capitalize">{m.role}: </span>
                  {m.content}
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t p-2">
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className="min-w-0 flex-1"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => void sendMessage()}
                disabled={loading || !input.trim()}
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      )}
      <Button
        type="button"
        size="icon"
        aria-label={open ? "Close chat" : "Open support chat"}
        onClick={() => setOpen((o) => !o)}
        className={cn("h-12 w-12 rounded-full shadow-md", open && "relative z-0")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </Button>
    </div>
  );
}
