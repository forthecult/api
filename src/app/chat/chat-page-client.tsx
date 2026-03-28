"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useSession } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import { Button } from "~/ui/primitives/button";
import { Input } from "~/ui/primitives/input";

const GUEST_KEY = "ftc-ai-guest-id";

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
        body: { characterSlug },
        credentials: "include",
        headers: {
          "x-ai-guest-id": guestId,
        },
      }),
    [characterSlug, guestId],
  );

  const chatId = `ftc-chat-${characterSlug}`;

  const { clearError, error, messages, sendMessage, status } = useChat({
    id: chatId,
    onError: (err) => {
      toast.error(err.message || "Something went wrong");
    },
    transport,
  });

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

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-5xl flex-col gap-6 p-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">AI chat</h1>
        <p className="text-sm text-muted-foreground">
          Personal, private agent. Messages stay in this browser.
        </p>
        <p className="text-xs text-muted-foreground">
          Uses{" "}
          <span className="font-medium text-foreground">AI SDK UI</span> (
          <code className="text-xs">@ai-sdk/react</code>{" "}
          <code className="text-xs">useChat</code>
          ) with streaming from{" "}
          <span className="font-medium text-foreground">AI SDK Core</span> on the
          server route.
        </p>
        {userId ? (
          <p className="text-xs">
            <Link
              className={`
                text-primary underline underline-offset-4
                hover:text-primary/90
              `}
              href="/dashboard/ai"
            >
              Account AI settings
            </Link>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            <Link
              className={`
                text-primary underline underline-offset-4
                hover:text-primary/90
              `}
              href="/login"
            >
              Sign in
            </Link>{" "}
            to sync your agent preferences across devices.
          </p>
        )}
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
            Say something to start. Guests get limited free messages.
          </p>
        ) : null}
        {messages.map((m) => (
          <div className="space-y-1" key={m.id}>
            <div className="text-xs text-muted-foreground uppercase">
              {m.role}
            </div>
            <div className="text-sm whitespace-pre-wrap">
              {m.parts?.map((p, i) =>
                p.type === "text" ? <span key={i}>{p.text}</span> : null,
              )}
            </div>
          </div>
        ))}
        {status === "streaming" ? (
          <p className="text-xs text-muted-foreground">Thinking…</p>
        ) : null}
      </div>

      <form className="flex gap-2" onSubmit={onSubmit}>
        <Input
          className="flex-1"
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message…"
          value={input}
        />
        <Button
          disabled={status === "streaming" || !input.trim()}
          type="submit"
        >
          Send
        </Button>
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
