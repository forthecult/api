"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Copy,
  ImageIcon,
  Loader2,
  Mic,
  Plus,
  RotateCcw,
  Settings2,
  Square,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useSession } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import { Button } from "~/ui/primitives/button";
import { Label } from "~/ui/primitives/label";
import { Slider } from "~/ui/primitives/slider";

const GUEST_KEY = "ftc-ai-guest-id";
const TEMP_KEY = "ftc-ai-temperature";
const TOP_P_KEY = "ftc-ai-top-p";
const USE_TOP_P_KEY = "ftc-ai-use-top-p";

interface VeniceCharacter {
  description: null | string;
  image_url: null | string;
  name: string;
  slug: string;
}

export function ChatPageClient() {
  const { data: sessionData } = useSession();
  const userId = sessionData?.user?.id ?? null;

  const [guestId, setGuestId] = useState("");
  const [input, setInput] = useState("");
  const [characters, setCharacters] = useState<VeniceCharacter[]>([]);
  const [charactersError, setCharactersError] = useState<null | string>(null);
  const [loadingCharacters, setLoadingCharacters] = useState(true);

  /** "default" = no Venice character slug on the model */
  const [characterSlug, setCharacterSlug] = useState("default");
  const [selectedMeta, setSelectedMeta] = useState<null | VeniceCharacter>(
    null,
  );
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.95);
  const [useTopP, setUseTopP] = useState(false);

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
      if (localStorage.getItem(USE_TOP_P_KEY) === "1") setUseTopP(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(TEMP_KEY, String(temperature));
    } catch {
      /* ignore */
    }
  }, [temperature]);

  useEffect(() => {
    try {
      localStorage.setItem(TOP_P_KEY, String(topP));
      localStorage.setItem(USE_TOP_P_KEY, useTopP ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [topP, useTopP]);

  useEffect(() => {
    // Guest id only exists in the browser; initialize after mount.
    // eslint-disable-next-line @eslint-react/set-state-in-effect -- localStorage-backed guest id
    setGuestId(getOrCreateGuestId());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await fetchJson<{ data?: VeniceCharacter[] }>(
          "/api/ai/characters?limit=48",
        );
        const list = Array.isArray(json.data) ? json.data : [];
        if (!cancelled) setCharacters(list);
      } catch (e) {
        if (!cancelled)
          setCharactersError(
            e instanceof Error ? e.message : "Could not load characters.",
          );
      } finally {
        if (!cancelled) setLoadingCharacters(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const json = await fetchJson<{
          agent?: { characterName: null | string; characterSlug: null | string; };
        }>("/api/ai/agent");
        const slug = json.agent?.characterSlug?.trim();
        if (cancelled || !slug) return;
        setCharacterSlug(slug);
        setSelectedMeta({
          description: null,
          image_url: null,
          name: json.agent?.characterName?.trim() || slug,
          slug,
        });
        const rawDetail = await fetch(
          `/api/ai/characters/${encodeURIComponent(slug)}`,
          { credentials: "include" },
        )
          .then((r) => r.json())
          .catch(() => null);
        const detail = parseVeniceCharacterDetail(rawDetail);
        if (!cancelled && detail)
          setSelectedMeta({
            description: detail.description ?? null,
            image_url: detail.image_url ?? null,
            name: detail.name || detail.slug,
            slug: detail.slug,
          });
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const persistAgentCharacter = useCallback(
    async (next: null | VeniceCharacter) => {
      if (!userId) return;
      await fetch("/api/ai/agent", {
        body: JSON.stringify({
          characterName: next?.name ?? null,
          characterSlug: next?.slug ?? null,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
    },
    [userId],
  );

  const selectCharacter = useCallback(
    async (c: null | VeniceCharacter) => {
      if (c === null) {
        setCharacterSlug("default");
        setSelectedMeta(null);
        await persistAgentCharacter(null);
        return;
      }
      setCharacterSlug(c.slug);
      setSelectedMeta(c);
      await persistAgentCharacter(c);
    },
    [persistAgentCharacter],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        body: {
          characterSlug,
          ...(useTopP ? { topP } : { temperature }),
        },
        credentials: "include",
        headers: {
          "x-ai-guest-id": guestId,
        },
      }),
    [characterSlug, guestId, temperature, topP, useTopP],
  );

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
      toast.error(err.message || "Something went wrong");
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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    void sendMessage({
      parts: [{ text, type: "text" }],
      role: "user",
    });
    setInput("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const newChat = () => {
    setSessionId(crypto.randomUUID());
    setMessages([]);
    clearError();
    toast.message("Started a new chat in this tab.");
  };

  const deleteAssistantMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const startSpeech = () => {
    const w = window as unknown as {
      SpeechRecognition?: new () => {
        interimResults: boolean;
        lang: string;
        maxAlternatives: number;
        onerror: (() => void) | null;
        onresult: ((ev: Event) => void) | null;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        interimResults: boolean;
        lang: string;
        maxAlternatives: number;
        onerror: (() => void) | null;
        onresult: ((ev: Event) => void) | null;
        start: () => void;
      };
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (ev: Event) => {
      const anyEv = ev as unknown as {
        results?: { item: (i: number) => { transcript: string } };
      };
      const transcript = anyEv.results?.item(0)?.transcript;
      if (transcript)
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = () => {
      toast.error("Speech recognition failed");
    };
    recognition.start();
    toast.message("Listening… speak now.");
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-5xl flex-col gap-6 p-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">AI chat</h1>
            <p className="text-sm text-muted-foreground">
              Personal, private agent. Messages stay in this browser unless you add
              server-side backups later.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={newChat}
              size="sm"
              type="button"
              variant="outline"
            >
              <Plus aria-hidden className="mr-1 h-4 w-4" />
              New chat
            </Button>
            {userId ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/ai">Account & memory</Link>
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>

        <details className="rounded-lg border border-border bg-card p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Capabilities vs Venice web app
          </summary>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Full character editing (intro, instructions, custom system prompt,
            context, temperature per character) is available in the Venice app
            when you manage characters there. This chat uses the character slug
            you pick and applies session sampling below. Memory import/export UI
            is evolving—use account links when available.
          </p>
          <p className="mt-2 text-muted-foreground">
            <Link
              className={`
                text-primary underline underline-offset-4
                hover:text-primary/90
              `}
              href="/dashboard/ai"
            >
              Dashboard AI
            </Link>{" "}
            ·{" "}
            <a
              className={`
                text-primary underline underline-offset-4
                hover:text-primary/90
              `}
              href="https://venice.ai"
              rel="noopener noreferrer"
              target="_blank"
            >
              Venice
            </a>
          </p>
        </details>
      </div>

      {error ? (
        <div
          className={`
            rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3
            text-sm text-destructive
          `}
          role="alert"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 flex-1 font-medium">{error.message}</p>
            <Button
              className="shrink-0"
              onClick={() => clearError()}
              size="sm"
              type="button"
              variant="outline"
            >
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <details className="rounded-lg border border-border bg-muted/30 p-3">
        <summary className={`
          flex cursor-pointer items-center gap-2 text-sm font-medium
        `}>
          <Settings2 aria-hidden className="h-4 w-4" />
          Model sampling (session)
        </summary>
        <div className="mt-3 space-y-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              checked={useTopP}
              onChange={(e) => setUseTopP(e.target.checked)}
              type="checkbox"
            />
            Use Top P instead of temperature
          </label>
          {!useTopP ? (
            <div className="space-y-2">
              <Label className="text-xs">
                Temperature: {temperature.toFixed(2)}
              </Label>
              <Slider
                max={2}
                min={0}
                onValueChange={(v) => setTemperature(v[0] ?? 0.7)}
                step={0.05}
                value={[temperature]}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs">Top P: {topP.toFixed(2)}</Label>
              <Slider
                max={1}
                min={0.05}
                onValueChange={(v) => setTopP(v[0] ?? 0.95)}
                step={0.05}
                value={[topP]}
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Web search, URL scraping, and vision uploads require API support in
            the route—they are not toggled here yet.
          </p>
        </div>
      </details>

      <div className={`
        flex flex-col gap-6
        lg:flex-row
      `}>
        <div className="lg:w-[min(100%,380px)] lg:shrink-0">
          {selectedMeta && selectedMeta.slug !== "default" ? (
            <div className={`
              overflow-hidden rounded-2xl border border-border bg-card shadow-sm
            `}>
              <div className="relative aspect-[4/5] w-full bg-muted">
                {selectedMeta.image_url ? (
                  <img
                    alt=""
                    className="h-full w-full object-cover"
                    height={480}
                    src={selectedMeta.image_url}
                    width={400}
                  />
                ) : (
                  <div className={`
                    flex h-full items-center justify-center text-4xl
                    font-semibold text-muted-foreground
                  `}>
                    {selectedMeta.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="space-y-1 p-4">
                <p className="text-lg leading-tight font-semibold">
                  {selectedMeta.name}
                </p>
                {selectedMeta.description ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {selectedMeta.description}
                  </p>
                ) : null}
                <Button
                  className="mt-2 w-full"
                  onClick={() => void selectCharacter(null)}
                  type="button"
                  variant="outline"
                >
                  Chat without a character
                </Button>
              </div>
            </div>
          ) : (
            <div className={`
              rounded-2xl border border-dashed border-border bg-muted/40 p-6
              text-center
            `}>
              <p className="text-sm text-muted-foreground">
                Optional: pick a character below for a styled persona—or start
                typing for a default assistant.
              </p>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-tight">Characters</h2>
            {loadingCharacters ? (
              <span className="text-xs text-muted-foreground">Loading…</span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {characters.length} shown
              </span>
            )}
          </div>
          {charactersError ? (
            <p className="text-sm text-destructive">{charactersError}</p>
          ) : null}
          <div
            className={cn(
              "grid max-h-[min(360px,50vh)] grid-cols-4 gap-2 overflow-y-auto",
              `
                sm:grid-cols-6
                md:grid-cols-8
              `,
            )}
          >
            {characters.map((c) => {
              const active = selectedMeta?.slug === c.slug;
              return (
                <button
                  className={cn(
                    `
                      aspect-square overflow-hidden rounded-2xl border
                      focus-visible:ring-ring
                    `,
                    `
                      transition
                      hover:opacity-95
                      focus-visible:ring-2 focus-visible:outline-none
                    `,
                    active
                      ? "border-primary ring-2 ring-primary"
                      : "border-border",
                  )}
                  key={c.slug}
                  onClick={() => void selectCharacter(c)}
                  title={c.name}
                  type="button"
                >
                  {c.image_url ? (
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      height={96}
                      src={c.image_url}
                      width={96}
                    />
                  ) : (
                    <div className={`
                      flex h-full w-full items-center justify-center bg-muted
                      text-xs font-medium text-muted-foreground
                    `}>
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`
        min-h-[280px] flex-1 space-y-3 rounded-lg border border-border bg-card
        p-3
      `}>
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Say something to start. Guests get limited free messages. Press{" "}
            <kbd className="rounded border bg-muted px-1">Enter</kbd> to send,{" "}
            <kbd className="rounded border bg-muted px-1">Shift+Enter</kbd> for a
            new line.
          </p>
        ) : null}
        {messages.map((m) => {
          const text = messageText(m);
          const isAssistant = m.role === "assistant";
          return (
            <div className="space-y-1" key={m.id}>
              <div className="text-xs text-muted-foreground uppercase">
                {m.role}
              </div>
              <div className="text-sm whitespace-pre-wrap">{text}</div>
              {isAssistant && text ? (
                <div className="flex flex-wrap gap-1 pt-1 text-muted-foreground">
                  <Button
                    className="h-8 px-2"
                    onClick={() => void copyText(text)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Copy aria-hidden className="mr-1 h-3.5 w-3.5" />
                    Copy
                  </Button>
                  {m.id === lastAssistantId ? (
                    <Button
                      className="h-8 px-2"
                      disabled={busy}
                      onClick={() => void regenerate()}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <RotateCcw aria-hidden className="mr-1 h-3.5 w-3.5" />
                      Regenerate
                    </Button>
                  ) : null}
                  <Button
                    className={`
                      h-8 px-2 text-destructive
                      hover:text-destructive
                    `}
                    onClick={() => deleteAssistantMessage(m.id)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden className="mr-1 h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
        {busy ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
            Thinking…
          </p>
        ) : null}
      </div>

      <form className="flex flex-col gap-2" onSubmit={onSubmit}>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={startSpeech}
            size="sm"
            title="Speak to type (browser speech recognition)"
            type="button"
            variant="outline"
          >
            <Mic aria-hidden className="mr-1 h-4 w-4" />
            Dictate
          </Button>
          <Button
            onClick={() =>
              toast.message(
                "Image + vision is not enabled for this route yet. Wire multipart input and a vision model on the server to enable.",
              )
            }
            size="sm"
            type="button"
            variant="outline"
          >
            <ImageIcon aria-hidden className="mr-1 h-4 w-4" />
            Image
          </Button>
          {busy ? (
            <Button
              onClick={() => stop()}
              size="sm"
              type="button"
              variant="destructive"
            >
              <Square aria-hidden className="mr-1 h-4 w-4" />
              Stop
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <textarea
            className={cn(
              "border-input bg-background ring-offset-background",
              "placeholder:text-muted-foreground",
              `
                flex min-h-[44px] w-full min-w-0 flex-1
                focus-visible:ring-ring
              `,
              "rounded-md border px-3 py-2 text-sm",
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
            rows={3}
            value={input}
          />
          <Button
            className="self-end"
            disabled={busy || !input.trim()}
            type="submit"
          >
            Send
          </Button>
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

function messageText(m: {
  parts?: { text?: string; type: string }[];
}): string {
  if (!m.parts?.length) return "";
  return m.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
}

function parseVeniceCharacterDetail(json: unknown): null | VeniceCharacter {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const inner =
    o.data && typeof o.data === "object"
      ? (o.data as Record<string, unknown>)
      : o;
  const slug = typeof inner.slug === "string" ? inner.slug : null;
  if (!slug) return null;
  return {
    description:
      typeof inner.description === "string" ? inner.description : null,
    image_url: typeof inner.image_url === "string" ? inner.image_url : null,
    name: typeof inner.name === "string" ? inner.name : slug,
    slug,
  };
}
