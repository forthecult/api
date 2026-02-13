"use client";

import React from "react";
import { usePathname } from "next/navigation";

import { cn } from "~/lib/cn";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/ui/primitives/dialog";
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
  const [endChatDialogOpen, setEndChatDialogOpen] = React.useState(false);
  const [endingChat, setEndingChat] = React.useState(false);
  const guestIdRef = React.useRef<string | null>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesScrollRef = React.useRef<HTMLDivElement>(null);

  // ── Drag-to-move state ──────────────────────────────────────────────
  const [position, setPosition] = React.useState<{ bottom: number; right: number }>({ bottom: 16, right: 16 });
  const isDraggingRef = React.useRef(false);
  const dragStartRef = React.useRef({ mouseX: 0, mouseY: 0, bottom: 16, right: 16 });
  const hasDraggedRef = React.useRef(false);
  const latestPosRef = React.useRef({ bottom: 16, right: 16 });

  // Load persisted position from localStorage
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("support-chat-pos");
      if (raw) {
        const p = JSON.parse(raw) as { bottom?: number; right?: number };
        if (typeof p.bottom === "number" && typeof p.right === "number") {
          const clamped = {
            bottom: Math.max(16, Math.min(window.innerHeight - 64, p.bottom)),
            right: Math.max(16, Math.min(window.innerWidth - 64, p.right)),
          };
          setPosition(clamped);
          latestPosRef.current = clamped;
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleDragStart = React.useCallback((clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      bottom: latestPosRef.current.bottom,
      right: latestPosRef.current.right,
    };
  }, []);

  const handleDragMove = React.useCallback((clientX: number, clientY: number) => {
    if (!isDraggingRef.current) return;
    const dx = clientX - dragStartRef.current.mouseX;
    const dy = clientY - dragStartRef.current.mouseY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasDraggedRef.current = true;
    }
    const next = {
      right: Math.max(16, Math.min(window.innerWidth - 64, dragStartRef.current.right - dx)),
      bottom: Math.max(16, Math.min(window.innerHeight - 64, dragStartRef.current.bottom - dy)),
    };
    latestPosRef.current = next;
    setPosition(next);
  }, []);

  const handleDragEnd = React.useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      localStorage.setItem("support-chat-pos", JSON.stringify(latestPosRef.current));
    } catch {
      /* ignore */
    }
  }, []);

  // Global pointer listeners for drag tracking
  React.useEffect(() => {
    const onMM = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
    const onMU = () => handleDragEnd();
    const onTM = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) handleDragMove(t.clientX, t.clientY);
    };
    const onTE = () => handleDragEnd();
    document.addEventListener("mousemove", onMM);
    document.addEventListener("mouseup", onMU);
    document.addEventListener("touchmove", onTM, { passive: true });
    document.addEventListener("touchend", onTE);
    return () => {
      document.removeEventListener("mousemove", onMM);
      document.removeEventListener("mouseup", onMU);
      document.removeEventListener("touchmove", onTM);
      document.removeEventListener("touchend", onTE);
    };
  }, [handleDragMove, handleDragEnd]);

  /** Shared pointer-down handler for draggable areas (FAB button + chat header) */
  const onPointerDownDrag = React.useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if ("touches" in e) {
        const t = e.touches[0];
        if (t) handleDragStart(t.clientX, t.clientY);
      } else {
        e.preventDefault();
        handleDragStart(e.clientX, e.clientY);
      }
    },
    [handleDragStart],
  );
  // ── End drag-to-move ────────────────────────────────────────────────

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
    const openConversations = list.filter((c) => c.status === "open");
    if (openConversations.length > 0) {
      setConversationId(openConversations[0]!.id);
      return openConversations[0]!.id;
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
    setLoading(false); // clear typing indicator when we get latest messages (e.g. AI reply arrived)
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
    let expectingAiReply = false;
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
        rateLimited?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "Failed to send.");
        setLoading(false);
        return;
      }
      setMessages(data.messages ?? []);
      setTakenOverBy(data.takenOverBy ?? null);
      expectingAiReply = !data.takenOverBy && !data.rateLimited;
      if (!expectingAiReply) setLoading(false);
    } finally {
      if (!expectingAiReply) setLoading(false);
    }
  }, [input, conversationId, ensureConversation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const handleCloseClick = () => {
    setEndChatDialogOpen(true);
  };

  const handleEndChatConfirm = React.useCallback(async () => {
    const cid = conversationId;
    setEndingChat(true);
    try {
      if (cid) {
        const guestId = getGuestId();
        await fetch(
          `${API_BASE}/api/support-chat/conversations/${cid}`,
          {
            method: "PATCH",
            credentials: "include",
            headers: getHeaders(guestId),
          },
        );
      }
      setConversationId(null);
      setMessages([]);
      setError(null);
      setTakenOverBy(null);
      setEndChatDialogOpen(false);
      setOpen(false);
    } finally {
      setEndingChat(false);
    }
  }, [conversationId]);

  if (isCheckout) return null;

  const quickPrompts = [
    { label: "Place an Order", icon: "🛒" },
    { label: "Order Status", icon: "📦" },
    { label: "Shipping Info", icon: "🚚" },
    { label: "Returns & Refunds", icon: "↩️" },
    { label: "Account Help", icon: "👤" },
  ];

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  // Scroll messages to bottom when typing indicator appears or when a new message arrives
  React.useEffect(() => {
    const el = messagesScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [loading, messages.length]);

  return (
    <div
      className="fixed z-50 flex flex-col items-end gap-2"
      style={{ bottom: `${position.bottom}px`, right: `${position.right}px` }}
    >
      {open && (
        <div
          className={cn(
            "relative z-10 flex w-[min(100vw-2rem,400px)] flex-col rounded-xl border bg-background shadow-xl",
            "max-h-[min(90vh,640px)] overflow-hidden",
          )}
        >
          {/* Header with avatar – draggable */}
          <div
            className="flex items-center gap-3 border-b px-4 py-3 cursor-grab active:cursor-grabbing select-none"
            onMouseDown={onPointerDownDrag}
            onTouchStart={onPointerDownDrag}
          >
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
              {/* Avatar placeholder – replace src with actual Alice avatar */}
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
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full border-2 border-background bg-green-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">
                {takenOverBy ? "Live Support Agent" : "Alice AI Support Agent"}
              </span>
              <span className="text-muted-foreground text-xs">
                {takenOverBy ? "A team member is helping you" : "Online · Typically replies instantly"}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Close chat"
              onClick={handleCloseClick}
              className="ml-auto h-8 w-8 shrink-0 p-0"
            >
              ×
            </Button>
          </div>

          {/* Messages area */}
          <div
            ref={messagesScrollRef}
            className="flex-1 overflow-y-auto p-3"
          >
            {messages.length === 0 && !loading && !error && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <p className="text-sm font-medium">Hi there! I&apos;m Alice</p>
                <p className="text-muted-foreground text-xs max-w-[240px]">
                  Your AI support assistant. How can I help you today?
                </p>
              </div>
            )}
            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}
            <ul className="space-y-2">
              {messages.map((m) => {
                const date = m.createdAt ? new Date(m.createdAt) : null;
                const timeStr = date
                  ? date.toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : "";
                return (
                  <li
                    key={m.id}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm",
                      m.role === "customer"
                        ? "ml-8 bg-primary text-primary-foreground"
                        : "mr-8 bg-muted",
                    )}
                  >
                    <span className="font-medium capitalize">{m.role === "customer" ? "You" : "Alice"}: </span>
                    {m.content}
                    {timeStr && (
                      <div
                        className={cn(
                          "mt-1 text-xs opacity-80",
                          m.role === "customer"
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground",
                        )}
                      >
                        {timeStr}
                      </div>
                    )}
                  </li>
                );
              })}
              {loading && (
                <li
                  className="mr-8 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <span className="font-medium text-muted-foreground">
                    {takenOverBy ? "Live Support Agent" : "Alice"}:
                  </span>
                  <span className="flex gap-1" aria-hidden>
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-muted-foreground/80 animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-muted-foreground/80 animate-bounce"
                      style={{ animationDelay: "160ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-muted-foreground/80 animate-bounce"
                      style={{ animationDelay: "320ms" }}
                    />
                  </span>
                </li>
              )}
            </ul>
          </div>

          {/* Quick prompts + input area */}
          <div className="border-t px-3 pb-2 pt-2">
            {messages.length === 0 && !loading && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {quickPrompts.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleQuickPrompt(p.label)}
                    className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted hover:border-primary/30 active:scale-95"
                  >
                    <span>{p.icon}</span>
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            )}
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
      <Dialog open={endChatDialogOpen} onOpenChange={setEndChatDialogOpen}>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>End chat</DialogTitle>
            <DialogDescription>
              This will end the current chat session. You can start a new chat
              anytime by opening the chat again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEndChatDialogOpen(false)}
              disabled={endingChat}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleEndChatConfirm()}
              disabled={endingChat}
            >
              {endingChat ? "Ending…" : "End chat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        type="button"
        size="icon"
        aria-label={open ? "Close chat" : "Open support chat"}
        onClick={() => {
          if (!hasDraggedRef.current) setOpen((o) => !o);
        }}
        onMouseDown={onPointerDownDrag}
        onTouchStart={onPointerDownDrag}
        className={cn(
          "h-12 w-12 rounded-full shadow-md cursor-grab active:cursor-grabbing",
          open && "relative z-0",
        )}
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
