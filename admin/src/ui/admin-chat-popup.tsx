"use client";

import { MessageCircle, X } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "~/lib/cn";
import { Button } from "~/ui/button";

const API_BASE =
  typeof process.env.NEXT_PUBLIC_MAIN_APP_URL === "string"
    ? process.env.NEXT_PUBLIC_MAIN_APP_URL
    : "http://localhost:3000";

const POLL_INTERVAL_MS = 8000;

interface ChatRow {
  id: string;
  status: string;
  takenOverBy: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageRole: string | null;
  lastMessageAt: string | null;
  customer: { id: string | null; name: string; email: string | null };
  guestId?: string;
}

interface Message {
  id: string;
  role: string;
  content: string;
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
}

function playDing() {
  try {
    const audioContext = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 800;
    oscillator.type = "sine";
    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.15,
    );
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  } catch {
    // ignore if audio not allowed
  }
}

function customerLabel(row: ChatRow): string {
  if (row.customer.id) {
    return row.customer.name || row.customer.email || "Customer";
  }
  return row.guestId ? `Guest ${row.guestId.slice(0, 8)}…` : "Guest";
}

export function AdminChatPopup() {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<ChatRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [staffInput, setStaffInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const lastSeenRef = useRef<Map<string, string>>(new Map());
  const initialPollDoneRef = useRef(false);
  const listPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [apiUnavailable, setApiUnavailable] = useState(false);

  const fetchList = useCallback(async () => {
    if (apiUnavailable) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/support-chat/conversations?limit=20&page=1`,
        { credentials: "include" },
      );
      if (!res.ok) {
        // Stop polling when main app isn't running (404) or not authenticated (401)
        if (res.status === 404 || res.status === 401) {
          if (listPollRef.current) {
            clearInterval(listPollRef.current);
            listPollRef.current = null;
          }
          setApiUnavailable(true);
        }
        return;
      }
      setApiUnavailable(false);
      const json = (await res.json()) as { items?: ChatRow[] };
      const items = json.items ?? [];
      const toAdd = new Set<string>();
      let didPlayDing = false;
      const initialDone = initialPollDoneRef.current;
      for (const c of items) {
        if (c.lastMessageRole === "customer" && c.lastMessageAt) {
          const lastSeen = lastSeenRef.current.get(c.id);
          const isNewMessage =
            initialDone &&
            (lastSeen
              ? new Date(c.lastMessageAt) > new Date(lastSeen)
              : true);
          if (isNewMessage) {
            toAdd.add(c.id);
            didPlayDing = true;
          }
          lastSeenRef.current.set(c.id, c.lastMessageAt);
        }
      }
      initialPollDoneRef.current = true;
      if (didPlayDing) {
        playDing();
      }
      setUnreadIds((prev) => {
        const next = new Set(prev);
        for (const id of toAdd) next.add(id);
        return next;
      });
      setConversations(items);
    } catch {
      // Network error (e.g. ERR_EMPTY_RESPONSE when main app not running): stop polling to avoid console spam
      if (listPollRef.current) {
        clearInterval(listPollRef.current);
        listPollRef.current = null;
      }
      setApiUnavailable(true);
    }
  }, [apiUnavailable]);

  useEffect(() => {
    if (apiUnavailable) return;
    fetchList();
    listPollRef.current = setInterval(fetchList, POLL_INTERVAL_MS);
    return () => {
      if (listPollRef.current) clearInterval(listPollRef.current);
    };
  }, [fetchList, apiUnavailable]);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/support-chat/conversations/${id}`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const json = (await res.json()) as ConversationDetail;
      setDetail(json);
      setUnreadIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      lastSeenRef.current.set(id, json.updatedAt);
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void fetchDetail(selectedId);
    else setDetail(null);
  }, [selectedId, fetchDetail]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages]);

  const handleSend = useCallback(async () => {
    const text = staffInput.trim();
    if (!text || !selectedId) return;
    setSending(true);
    setStaffInput("");
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/support-chat/conversations/${selectedId}/messages`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        },
      );
      if (res.ok) void fetchDetail(selectedId);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }, [selectedId, staffInput, fetchDetail]);

  const markConversationSeen = useCallback((id: string) => {
    setUnreadIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    const row = conversations.find((c) => c.id === id);
    if (row?.lastMessageAt) lastSeenRef.current.set(id, row.lastMessageAt);
  }, [conversations]);

  const openPopup = useCallback(() => {
    setOpen(true);
    void fetchList();
  }, [fetchList]);

  const selectConversation = useCallback(
    (id: string) => {
      setSelectedId(id);
      markConversationSeen(id);
    },
    [markConversationSeen],
  );

  const unreadCount = unreadIds.size;

  return (
    <>
      <button
        type="button"
        onClick={openPopup}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full shadow-lg",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          "transition-transform hover:scale-105",
        )}
        aria-label={
          unreadCount > 0
            ? `Support chat (${unreadCount} new)`
            : "Support chat"
        }
      >
        <MessageCircle className="size-7" />
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute -right-1 -top-1 flex min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-xs font-bold text-destructive-foreground",
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6"
          aria-modal
          role="dialog"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className={cn(
              "relative flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-background shadow-xl",
              "sm:h-[75vh]",
            )}
          >
            <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold">Support chat</h3>
              <div className="flex items-center gap-2">
                <Link
                  href="/support-chat"
                  className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                >
                  Full list
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  <X className="size-5" />
                </Button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1">
              <div className="w-56 shrink-0 border-r overflow-y-auto">
                <ul className="p-2">
                  {conversations.length === 0 ? (
                    <li className="p-2 text-sm text-muted-foreground">
                      No conversations
                    </li>
                  ) : (
                    conversations.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => selectConversation(row.id)}
                          className={cn(
                            "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                            selectedId === row.id
                              ? "bg-primary/10 font-medium text-primary"
                              : "hover:bg-muted",
                            unreadIds.has(row.id) && "font-semibold",
                          )}
                        >
                          <span className="block truncate">
                            {customerLabel(row)}
                          </span>
                          {unreadIds.has(row.id) && (
                            <span className="mt-0.5 block text-xs text-primary">
                              New message
                            </span>
                          )}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                {!selectedId ? (
                  <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    Select a conversation
                  </div>
                ) : detailLoading ? (
                  <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    Loading…
                  </div>
                ) : detail ? (
                  <>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {detail.messages.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No messages yet.
                        </p>
                      ) : (
                        detail.messages.map((m) => (
                          <div
                            key={m.id}
                            className={cn(
                              "rounded-lg px-3 py-2 text-sm",
                              m.role === "customer" &&
                                "ml-6 bg-primary/10 text-foreground",
                              m.role === "ai" &&
                                "mr-6 bg-muted text-muted-foreground",
                              m.role === "staff" &&
                                "mr-6 bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100",
                            )}
                          >
                            <span className="font-medium capitalize">
                              {m.role}:{" "}
                            </span>
                            {m.content}
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                    <div className="shrink-0 border-t p-3">
                      <div className="flex gap-2">
                        <input
                          className={cn(
                            "min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm",
                            "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                          )}
                          placeholder="Reply as staff…"
                          value={staffInput}
                          onChange={(e) => setStaffInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void handleSend();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => void handleSend()}
                          disabled={sending || !staffInput.trim()}
                        >
                          {sending ? "Sending…" : "Send"}
                        </Button>
                      </div>
                      <Link
                        href={`/support-chat/${detail.id}`}
                        className="mt-2 inline-block text-xs text-muted-foreground underline-offset-2 hover:underline"
                      >
                        Open full chat →
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    Failed to load
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
