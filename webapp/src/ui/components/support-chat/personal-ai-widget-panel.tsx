"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAiLocalStorageSync } from "~/app/chat/use-ai-local-storage-sync";
import { migrateLegacyAiKeys } from "~/lib/ai-local-bundle";
import { useSession } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import { Button } from "~/ui/primitives/button";

const GUEST_KEY = "culture-ai-guest-id";
const TEMP_KEY = "culture-ai-temperature";
const TOP_P_KEY = "culture-ai-top-p";
const WEB_KEY = "culture-ai-web-enabled";
const URL_SCRAPE_KEY = "culture-ai-url-scraping";

/** Inline Personal AI chat for the floating widget (same API as /chat). */
export function PersonalAiWidgetPanel() {
  const { data: sessionData } = useSession();
  const userId = sessionData?.user?.id ?? null;

  useEffect(() => {
    migrateLegacyAiKeys();
  }, []);

  const [guestId] = useState(() =>
    typeof window === "undefined" ? "" : getOrCreateGuestId(),
  );
  const [characterSlug, setCharacterSlug] = useState("default");
  const [sessionId] = useState(() => crypto.randomUUID());
  const [input, setInput] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.95);
  const [webEnabled, setWebEnabled] = useState(false);
  const [urlScrapingEnabled, setUrlScrapingEnabled] = useState(false);

  useAiLocalStorageSync({
    setTemperature,
    setTopP,
    setUrlScrapingEnabled,
    setWebEnabled,
  });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const json = await fetchJson<{
          agent?: { characterSlug: null | string };
        }>("/api/ai/agent");
        const slug = json.agent?.characterSlug?.trim();
        if (!cancelled && slug) setCharacterSlug(slug);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    try {
      const tv = localStorage.getItem(TEMP_KEY);
      if (tv) {
        const n = Number.parseFloat(tv);
        if (Number.isFinite(n) && n >= 0 && n <= 2) setTemperature(n);
      }
      const pv = localStorage.getItem(TOP_P_KEY);
      if (pv) {
        const n = Number.parseFloat(pv);
        if (Number.isFinite(n) && n > 0 && n <= 1) setTopP(n);
      }
      if (localStorage.getItem(WEB_KEY) === "1") setWebEnabled(true);
      if (localStorage.getItem(URL_SCRAPE_KEY) === "1")
        setUrlScrapingEnabled(true);
    } catch {
      /* ignore */
    }
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        body: {
          characterSlug,
          temperature,
          topP,
          urlScrapingEnabled,
          webSearchEnabled: webEnabled,
        },
        credentials: "include",
        headers: { "x-ai-guest-id": guestId },
      }),
    [characterSlug, guestId, temperature, topP, webEnabled, urlScrapingEnabled],
  );

  const chatId = useMemo(
    () => `ftc-widget-ai-${characterSlug}-${sessionId}`,
    [characterSlug, sessionId],
  );

  const { error, messages, sendMessage, status, stop } = useChat({
    id: chatId,
    onError: (err) => {
      toast.error(err.message || "Something went wrong");
    },
    transport,
  });

  const busy = status === "streaming" || status === "submitted";

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || busy) return;
      void sendMessage({ parts: [{ text, type: "text" }], role: "user" });
      setInput("");
    },
    [busy, input, sendMessage],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2",
          "text-sm",
        )}
      >
        {messages.length === 0 ? (
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            Your private assistant—same session as the full chat page.{" "}
            <Link
              className="text-primary underline underline-offset-2"
              href="/chat"
            >
              Open chat
            </Link>{" "}
            for characters & settings.
          </p>
        ) : null}
        {messages.map((m) => {
          const text = messageText(m);
          return (
            <div
              className={cn(
                "rounded-lg px-2.5 py-2",
                m.role === "user"
                  ? "ml-6 bg-primary text-primary-foreground"
                  : "mr-6 bg-muted",
              )}
              key={m.id}
            >
              <div className="text-[10px] font-medium uppercase opacity-80">
                {m.role}
              </div>
              <div className="mt-0.5 whitespace-pre-wrap">{text}</div>
            </div>
          );
        })}
        {busy ? (
          <p
            className={`
              flex items-center gap-2 px-1 text-xs text-muted-foreground
            `}
          >
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
            Thinking…
          </p>
        ) : null}
        {error ? (
          <p className="px-1 text-xs text-destructive">{error.message}</p>
        ) : null}
      </div>

      <form
        className="border-t bg-background px-3 pt-2 pb-3"
        onSubmit={onSubmit}
      >
        <div className="flex gap-2">
          <textarea
            className={cn(
              "border-input bg-background ring-offset-background",
              "placeholder:text-muted-foreground",
              `
                max-h-28 min-h-[40px] w-full min-w-0 flex-1
                focus-visible:ring-ring
              `,
              "resize-y rounded-md border px-2.5 py-2 text-sm",
              `
                focus-visible:ring-2 focus-visible:ring-offset-2
                focus-visible:outline-none
              `,
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Send a private message…"
            rows={2}
            value={input}
          />
          <div className="flex shrink-0 flex-col gap-1">
            {busy ? (
              <Button
                onClick={() => stop()}
                size="sm"
                type="button"
                variant="outline"
              >
                Stop
              </Button>
            ) : null}
            <Button disabled={busy || !input.trim()} size="sm" type="submit">
              Send
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

function getOrCreateGuestId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(GUEST_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_KEY, id);
  }
  return id;
}

function messageText(m: { parts?: { text?: string; type: string }[] }): string {
  if (!m.parts?.length) return "";
  return m.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
}
