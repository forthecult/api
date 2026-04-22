"use client";

import type { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";

import { useChat } from "@ai-sdk/react";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ChatSessionMeta } from "~/app/chat/chat-sidebar";

import {
  loadSessionMessages,
  saveSessionMessages,
} from "~/app/chat/chat-local";
import { messageText } from "~/app/chat/chat-message-utils";

export interface UseChatSessionOptions {
  characterSlug: string;
  onChatError?: (err: Error) => void;
  selectedProjectId: null | string;
  setSessions: Dispatch<SetStateAction<ChatSessionMeta[]>>;
  transport: DefaultChatTransport<UIMessage>;
  userId: null | string;
}

export interface UseChatSessionResult {
  busy: boolean;
  clearError: () => void;
  deleteAssistantMessage: (messageId: string) => void;
  error: Error | undefined;
  forgetConversationCreated: (conversationId: string) => void;
  lastAssistantId: null | string;
  messages: UIMessage[];
  newChat: (opts: {
    characterSlug: string;
    selectedProjectId: null | string;
    userId: null | string;
  }) => void;
  regenerate: () => Promise<void>;
  selectSession: (
    id: string,
    allSessions: ChatSessionMeta[],
    opts: {
      clearError: () => void;
      setSelectedProjectId: (id: null | string) => void;
    },
  ) => void;
  sendMessage: ReturnType<typeof useChat>["sendMessage"];
  sessionId: string;
  setMessages: Dispatch<SetStateAction<UIMessage[]>>;
  setSessionId: Dispatch<SetStateAction<string>>;
  status: ReturnType<typeof useChat>["status"];
  stop: () => Promise<void>;
}

export function useChatSession(
  options: UseChatSessionOptions,
): UseChatSessionResult {
  const {
    characterSlug,
    onChatError,
    selectedProjectId,
    setSessions,
    transport,
    userId,
  } = options;

  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const skipNextPersistRef = useRef(false);
  const createdConversationIdsRef = useRef<Set<string>>(new Set());
  const pendingConversationWriteRef = useRef<null | {
    body: string;
    created: boolean;
    sessionId: string;
  }>(null);

  const chatId = `ftc-chat-${characterSlug}-${sessionId}`;

  const {
    clearError,
    error,
    messages,
    regenerate,
    sendMessage,
    setMessages,
    status,
    stop,
  } = useChat({
    id: chatId,
    onError: (err) => {
      onChatError?.(err);
    },
    transport,
  });

  const busy = status === "streaming" || status === "submitted";

  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m?.role === "assistant") return m.id;
    }
    return null;
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    skipNextPersistRef.current = true;
    void (async () => {
      if (userId) {
        try {
          const res = await fetch(
            `/api/ai/conversations/${encodeURIComponent(sessionId)}`,
            { credentials: "include" },
          );
          if (res.ok) {
            const data = (await res.json()) as {
              conversation?: { messages?: unknown };
            };
            const raw = data.conversation?.messages;
            if (Array.isArray(raw) && raw.length) {
              if (!cancelled) setMessages(raw as UIMessage[]);
              return;
            }
          }
        } catch {
          /* fall back to local */
        }
      }
      try {
        const loaded = loadSessionMessages(sessionId);
        if (!cancelled) setMessages(loaded ?? []);
      } catch {
        if (!cancelled) setMessages([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, setMessages, userId]);

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    saveSessionMessages(sessionId, messages);
  }, [messages, sessionId]);

  useEffect(() => {
    if (!userId) return;
    if (skipNextPersistRef.current) return;
    if (messages.length === 0) return;
    const sid = sessionId;
    const firstUser = messages.find((m) => m.role === "user");
    const title = (firstUser ? messageText(firstUser).trim() : "") || "Chat";
    const payload = {
      characterSlug,
      messages,
      title: title.slice(0, 200),
    };
    const body = JSON.stringify(payload);
    const created = createdConversationIdsRef.current.has(sid);
    pendingConversationWriteRef.current = { body, created, sessionId: sid };

    const tid = window.setTimeout(() => {
      void (async () => {
        try {
          if (created) {
            await fetch(`/api/ai/conversations/${encodeURIComponent(sid)}`, {
              body,
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              method: "PUT",
            });
          } else {
            const res = await fetch("/api/ai/conversations", {
              body: JSON.stringify({ id: sid, ...payload }),
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              method: "POST",
            });
            if (res.ok || res.status === 409) {
              createdConversationIdsRef.current.add(sid);
            } else if (res.status === 404) {
              await fetch(`/api/ai/conversations/${encodeURIComponent(sid)}`, {
                body,
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                method: "PUT",
              });
              createdConversationIdsRef.current.add(sid);
            }
          }
          if (pendingConversationWriteRef.current?.sessionId === sid) {
            pendingConversationWriteRef.current = null;
          }
        } catch {
          /* ignore */
        }
      })();
    }, 1400);
    return () => window.clearTimeout(tid);
  }, [characterSlug, messages, sessionId, userId]);

  useEffect(() => {
    if (!userId) return;
    const flush = () => {
      const pending = pendingConversationWriteRef.current;
      if (!pending) return;
      pendingConversationWriteRef.current = null;
      try {
        const url = pending.created
          ? `/api/ai/conversations/${encodeURIComponent(pending.sessionId)}`
          : "/api/ai/conversations";
        const blob = new Blob(
          [
            pending.created
              ? pending.body
              : JSON.stringify({
                  id: pending.sessionId,
                  ...(JSON.parse(pending.body) as Record<string, unknown>),
                }),
          ],
          { type: "application/json" },
        );
        if (pending.created) {
          void fetch(url, {
            body: pending.body,
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            method: "PUT",
          }).catch(() => {
            /* ignore */
          });
        } else {
          navigator.sendBeacon?.(url, blob);
        }
      } catch {
        /* ignore */
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userId]);

  const upsertSessionTitle = useCallback(
    (id: string, title: string, opts?: { projectId?: null | string }) => {
      const now = Date.now();
      setSessions((prev) => {
        const existing = prev.find((s) => s.id === id);
        const projectId =
          opts?.projectId !== undefined
            ? opts.projectId
            : (existing?.projectId ?? null);
        const favorite = existing?.favorite ?? false;
        const next = prev.filter((s) => s.id !== id);
        next.unshift({
          favorite,
          id,
          projectId,
          title: title.slice(0, 120),
          updatedAt: now,
        });
        next.sort((a, b) => {
          if (Boolean(a.favorite) !== Boolean(b.favorite)) {
            return a.favorite ? -1 : 1;
          }
          return b.updatedAt - a.updatedAt;
        });
        return next;
      });
    },
    [setSessions],
  );

  useEffect(() => {
    if (messages.length === 0) return;
    const firstUser = messages.find((m) => m.role === "user");
    if (!firstUser) return;
    const t = messageText(firstUser).trim() || "Chat";
    upsertSessionTitle(
      sessionId,
      t,
      selectedProjectId ? { projectId: selectedProjectId } : {},
    );
  }, [messages, selectedProjectId, sessionId, upsertSessionTitle]);

  const newChat = useCallback(
    (opts: {
      characterSlug: string;
      selectedProjectId: null | string;
      userId: null | string;
    }) => {
      const id = crypto.randomUUID();
      setSessionId(id);
      setMessages([]);
      clearError();
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        next.unshift({
          favorite: false,
          id,
          projectId: opts.selectedProjectId ?? null,
          title: "New chat",
          updatedAt: Date.now(),
        });
        next.sort((a, b) => {
          if (Boolean(a.favorite) !== Boolean(b.favorite)) {
            return a.favorite ? -1 : 1;
          }
          return b.updatedAt - a.updatedAt;
        });
        return next;
      });
      if (opts.userId) {
        void (async () => {
          try {
            const res = await fetch("/api/ai/conversations", {
              body: JSON.stringify({
                characterSlug: opts.characterSlug,
                id,
                messages: [],
                title: null,
              }),
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              method: "POST",
            });
            if (res.ok || res.status === 409) {
              createdConversationIdsRef.current.add(id);
            }
          } catch {
            /* ignore */
          }
        })();
      }
    },
    [clearError, setMessages, setSessions],
  );

  const selectSession = useCallback(
    (
      id: string,
      allSessions: ChatSessionMeta[],
      opts: {
        clearError: () => void;
        setSelectedProjectId: (pid: null | string) => void;
      },
    ) => {
      if (id === sessionId) return;
      setSessionId(id);
      const loaded = loadSessionMessages(id);
      setMessages(loaded ?? []);
      opts.clearError();
      const meta = allSessions.find((s) => s.id === id);
      if (meta?.projectId) opts.setSelectedProjectId(meta.projectId);
      else opts.setSelectedProjectId(null);
    },
    [sessionId, setMessages],
  );

  const deleteAssistantMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, [setMessages]);

  const forgetConversationCreated = useCallback((conversationId: string) => {
    createdConversationIdsRef.current.delete(conversationId);
  }, []);

  return {
    busy,
    clearError,
    deleteAssistantMessage,
    error,
    forgetConversationCreated,
    lastAssistantId,
    messages,
    newChat,
    regenerate,
    selectSession,
    sendMessage,
    sessionId,
    setMessages,
    setSessionId,
    status,
    stop,
  };
}
