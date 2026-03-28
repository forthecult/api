"use client";

import { Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import React from "react";

import { cn } from "~/lib/cn";
import { PersonalAiWidgetPanel } from "~/ui/components/support-chat/personal-ai-widget-panel";
import { Button } from "~/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/ui/primitives/dialog";
import { Input } from "~/ui/primitives/input";

const GUEST_ID_KEY = "support-chat-guest-id";
const POLL_INTERVAL_MS = 3_000;
const API_BASE = "";

interface Conversation {
  createdAt: string;
  id: string;
  status: string;
  takenOverBy: null | string;
  updatedAt: string;
}

interface Message {
  content: string;
  createdAt: string;
  id: string;
  role: string;
}

export function SupportChatWidget({
  personalAi = true,
  supportAgent = true,
}: {
  personalAi?: boolean;
  supportAgent?: boolean;
} = {}) {
  const pathname = usePathname();
  const isCheckout = pathname?.startsWith("/checkout") ?? false;
  const [open, setOpen] = React.useState(false);
  const [conversationId, setConversationId] = React.useState<null | string>(
    null,
  );
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<null | string>(null);
  const [takenOverBy, setTakenOverBy] = React.useState<null | string>(null);
  const [widgetMode, setWidgetMode] = React.useState<"personal" | "support">(
    () => {
      if (!supportAgent && personalAi) return "personal";
      return "support";
    },
  );
  const [endChatDialogOpen, setEndChatDialogOpen] = React.useState(false);
  const [endingChat, setEndingChat] = React.useState(false);
  const guestIdRef = React.useRef<null | string>(null);
  const pollRef = React.useRef<null | ReturnType<typeof setInterval>>(null);
  const messagesScrollRef = React.useRef<HTMLDivElement>(null);

  // ── Drag-to-move state ──────────────────────────────────────────────
  const [position, setPosition] = React.useState<{
    bottom: number;
    right: number;
  }>({ bottom: 16, right: 16 });
  const isDraggingRef = React.useRef(false);
  const dragStartRef = React.useRef({
    bottom: 16,
    mouseX: 0,
    mouseY: 0,
    right: 16,
  });
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

  const handleDragStart = React.useCallback(
    (clientX: number, clientY: number) => {
      isDraggingRef.current = true;
      hasDraggedRef.current = false;
      dragStartRef.current = {
        bottom: latestPosRef.current.bottom,
        mouseX: clientX,
        mouseY: clientY,
        right: latestPosRef.current.right,
      };
    },
    [],
  );

  const handleDragMove = React.useCallback(
    (clientX: number, clientY: number) => {
      if (!isDraggingRef.current) return;
      const dx = clientX - dragStartRef.current.mouseX;
      const dy = clientY - dragStartRef.current.mouseY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasDraggedRef.current = true;
      }
      const next = {
        bottom: Math.max(
          16,
          Math.min(window.innerHeight - 64, dragStartRef.current.bottom - dy),
        ),
        right: Math.max(
          16,
          Math.min(window.innerWidth - 64, dragStartRef.current.right - dx),
        ),
      };
      latestPosRef.current = next;
      setPosition(next);
    },
    [],
  );

  const handleDragEnd = React.useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      localStorage.setItem(
        "support-chat-pos",
        JSON.stringify(latestPosRef.current),
      );
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
      credentials: "include",
      headers: getHeaders(guestId),
      method: "POST",
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

  // When chat opens: only load an existing open conversation; do NOT create one.
  // A conversation is created only when the customer sends their first message.
  React.useEffect(() => {
    if (!open || widgetMode !== "support") return;
    let cancelled = false;
    (async () => {
      if (conversationId) {
        await fetchMessages(conversationId);
        return;
      }
      const list = await fetchConversations();
      const openConversations = list.filter((c) => c.status === "open");
      if (cancelled) return;
      if (openConversations.length > 0) {
        const cid = openConversations[0]!.id;
        setConversationId(cid);
        await fetchMessages(cid);
      }
      // No open conversation: leave conversationId null; creation happens on first send.
    })();
    return () => {
      cancelled = true;
    };
  }, [open, conversationId, fetchConversations, fetchMessages, widgetMode]);

  React.useEffect(() => {
    if (!open || !conversationId || widgetMode !== "support") return;
    const id = setInterval(() => {
      fetchMessages(conversationId);
    }, POLL_INTERVAL_MS);
    pollRef.current = id;
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [open, conversationId, fetchMessages, widgetMode]);

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
          body: JSON.stringify({ content: text }),
          credentials: "include",
          headers: getHeaders(guestId),
          method: "POST",
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        messages?: Message[];
        rateLimited?: boolean;
        takenOverBy?: string;
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
        await fetch(`${API_BASE}/api/support-chat/conversations/${cid}`, {
          credentials: "include",
          headers: getHeaders(guestId),
          method: "PATCH",
        });
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

  // scroll to bottom when typing indicator or new message; defer in rAF to avoid forced reflow (PageSpeed)
  React.useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      const el = messagesScrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(rafId);
  }, [loading, messages.length]);

  const quickPrompts = [
    { icon: "🛒", label: "Place an Order" },
    { icon: "📦", label: "Order Status" },
    { icon: "🚚", label: "Shipping Info" },
    { icon: "↩️", label: "Returns & Refunds" },
    { icon: "👤", label: "Account Help" },
  ];

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  if (isCheckout) return null;
  if (pathname === "/chat") return null;

  return (
    <div
      className="fixed z-50 flex flex-col items-end gap-2"
      style={{ bottom: `${position.bottom}px`, right: `${position.right}px` }}
    >
      {open && (
        <div
          className={cn(
            `
              relative z-10 flex w-[min(100vw-2rem,400px)] flex-col rounded-xl
              border bg-background shadow-xl
            `,
            "max-h-[min(90vh,640px)] overflow-hidden",
          )}
        >
          {supportAgent && personalAi ? (
            <div className="flex gap-1 border-b bg-muted/30 p-1.5">
              <button
                className={cn(
                  `
                    flex-1 rounded-md py-2 text-xs font-semibold
                    transition-colors
                    sm:text-sm
                  `,
                  widgetMode === "support"
                    ? "bg-background text-foreground shadow-sm"
                    : `
                      text-muted-foreground
                      hover:text-foreground
                    `,
                )}
                onClick={() => setWidgetMode("support")}
                type="button"
              >
                Store support
              </button>
              <button
                className={cn(
                  `
                    flex-1 rounded-md py-2 text-xs font-semibold
                    transition-colors
                    sm:text-sm
                  `,
                  widgetMode === "personal"
                    ? "bg-background text-foreground shadow-sm"
                    : `
                      text-muted-foreground
                      hover:text-foreground
                    `,
                )}
                onClick={() => setWidgetMode("personal")}
                type="button"
              >
                Personal AI
              </button>
            </div>
          ) : null}

          {widgetMode === "personal" ? (
            <div className="flex min-h-0 max-h-[min(60vh,520px)] min-h-[280px] flex-col">
              <div
                className={`
                  flex cursor-grab items-center gap-3 border-b px-4 py-3
                  select-none
                  active:cursor-grabbing
                `}
                onMouseDown={onPointerDownDrag}
                onTouchStart={onPointerDownDrag}
              >
                <div
                  className={`
                    flex h-10 w-10 shrink-0 items-center justify-center
                    rounded-full bg-primary/15 text-primary
                  `}
                >
                  <Sparkles aria-hidden className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-base leading-tight font-semibold">
                    Personal AI
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Assistant & characters
                  </span>
                </div>
                <Button
                  aria-label="Close"
                  className="h-8 w-8 shrink-0 p-0"
                  onClick={() => setOpen(false)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  ×
                </Button>
              </div>
              <PersonalAiWidgetPanel />
            </div>
          ) : (
            <>
              {/* Header with avatar – draggable */}
              <div
                className={`
                  flex cursor-grab items-center gap-3 border-b px-4 py-3
                  select-none
                  active:cursor-grabbing
                `}
                onMouseDown={onPointerDownDrag}
                onTouchStart={onPointerDownDrag}
              >
                <div
                  className={`
                    relative flex h-10 w-10 shrink-0 items-center justify-center
                    rounded-full bg-primary text-white shadow-sm
                  `}
                >
                  {/* Avatar */}
                  <svg
                    fill="none"
                    height="20"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span
                    className={`
                      absolute -right-0.5 -bottom-0.5 block h-3 w-3 rounded-full
                      border-2 border-background bg-green-500
                    `}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-base leading-tight font-semibold">
                    {takenOverBy ? "Live Support" : "Support"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {takenOverBy
                      ? "A team member is helping you"
                      : "Online"}
                  </span>
                </div>
                <Button
                  aria-label="Close chat"
                  className="ml-auto h-8 w-8 shrink-0 p-0"
                  onClick={handleCloseClick}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  ×
                </Button>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-3" ref={messagesScrollRef}>
                {messages.length === 0 && !loading && !error && (
                  <div className={`
                    flex flex-col items-center gap-2 py-6 text-center
                  `}>
                    <div
                      className={`
                        flex h-14 w-14 items-center justify-center rounded-full
                        bg-primary text-primary-foreground shadow-md
                      `}
                    >
                      <svg
                        fill="none"
                        height="28"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        width="28"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <p className="text-base font-medium">
                      Hi there! I&apos;m Alice
                    </p>
                    <p className="max-w-[240px] text-sm text-muted-foreground">
                      Your AI support assistant. How can I help you today?
                    </p>
                  </div>
                )}
                {error && <p className="text-sm text-destructive">{error}</p>}
                <ul className="space-y-2">
                  {messages.map((m) => {
                    const date = m.createdAt ? new Date(m.createdAt) : null;
                    const timeStr = date
                      ? date.toLocaleTimeString(undefined, {
                          hour: "numeric",
                          hour12: true,
                          minute: "2-digit",
                        })
                      : "";
                    return (
                      <li
                        className={cn(
                          "rounded-lg px-3 py-2 text-base",
                          m.role === "customer"
                            ? "ml-8 bg-primary text-primary-foreground"
                            : "mr-8 bg-muted",
                        )}
                        key={m.id}
                      >
                        <span className="font-medium capitalize">
                          {m.role === "customer" ? "You" : "Alice"}:{" "}
                        </span>
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
                      aria-busy="true"
                      aria-live="polite"
                      className={`
                        mr-8 flex items-center gap-2 rounded-lg bg-muted px-3
                        py-2 text-base
                      `}
                    >
                      <span className="font-medium text-muted-foreground">
                        {takenOverBy ? "Live Support Agent" : "Alice"}:
                      </span>
                      <span aria-hidden className="flex gap-1">
                        <span
                          className={`
                            h-1.5 w-1.5 animate-bounce rounded-full
                            bg-muted-foreground/80
                          `}
                          style={{ animationDelay: "0ms" }}
                        />
                        <span
                          className={`
                            h-1.5 w-1.5 animate-bounce rounded-full
                            bg-muted-foreground/80
                          `}
                          style={{ animationDelay: "160ms" }}
                        />
                        <span
                          className={`
                            h-1.5 w-1.5 animate-bounce rounded-full
                            bg-muted-foreground/80
                          `}
                          style={{ animationDelay: "320ms" }}
                        />
                      </span>
                    </li>
                  )}
                </ul>
              </div>

              {/* Quick prompts + input area */}
              <div className="border-t px-3 pt-2 pb-2">
                {messages.length === 0 && !loading && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {quickPrompts.map((p) => (
                      <button
                        className={`
                          inline-flex items-center gap-1.5 rounded-full border
                          bg-muted/50 px-3.5 py-2 text-sm font-medium
                          transition-colors
                          hover:border-primary/30 hover:bg-muted
                          active:scale-95
                        `}
                        key={p.label}
                        onClick={() => handleQuickPrompt(p.label)}
                        type="button"
                      >
                        <span>{p.icon}</span>
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    className="min-w-0 flex-1"
                    disabled={loading}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    value={input}
                  />
                  <Button
                    disabled={loading || !input.trim()}
                    onClick={() => void sendMessage()}
                    size="sm"
                    type="button"
                  >
                    Send
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      <Dialog onOpenChange={setEndChatDialogOpen} open={endChatDialogOpen}>
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
              disabled={endingChat}
              onClick={() => setEndChatDialogOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={endingChat}
              onClick={() => void handleEndChatConfirm()}
              type="button"
            >
              {endingChat ? "Ending…" : "End chat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        aria-label={open ? "Close chat" : "Open support chat"}
        className={cn(
          `
            h-12 w-12 cursor-grab rounded-full shadow-md
            active:cursor-grabbing
          `,
          open && "relative z-0",
        )}
        onClick={() => {
          if (!hasDraggedRef.current) setOpen((o) => !o);
        }}
        onMouseDown={onPointerDownDrag}
        onTouchStart={onPointerDownDrag}
        size="icon"
        type="button"
      >
        <svg
          fill="none"
          height="20"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </Button>
    </div>
  );
}

function getGuestId(): null | string {
  if (typeof window === "undefined") return null;
  let id = sessionStorage.getItem(GUEST_ID_KEY);
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  ) {
    id = crypto.randomUUID();
    sessionStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

function getHeaders(guestId: null | string): HeadersInit {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Support-Source": "web",
  };
  if (guestId) h["X-Support-Guest-Id"] = guestId;
  return h;
}
