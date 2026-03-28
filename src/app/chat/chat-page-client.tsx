"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useState } from "react";

import { Button } from "~/ui/primitives/button";
import { Input } from "~/ui/primitives/input";

const GUEST_KEY = "ftc-ai-guest-id";

function getOrCreateGuestId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(GUEST_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_KEY, id);
  }
  return id;
}

export function ChatPageClient() {
  const [characterSlug, setCharacterSlug] = useState("default");
  const [guestId, setGuestId] = useState("");
  const [input, setInput] = useState("");

  useEffect(() => {
    setGuestId(getOrCreateGuestId());
  }, []);

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

  const { messages, sendMessage, status } = useChat({ transport });

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
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col gap-4 p-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">AI chat</h1>
        <p className="text-muted-foreground text-sm">
          Personal agent via Venice. Messages stay in this browser unless you
          use backup in settings.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid w-full max-w-sm gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="slug">
            Character slug (Venice)
          </label>
          <Input
            id="slug"
            onChange={(e) => setCharacterSlug(e.target.value || "default")}
            placeholder="default"
            value={characterSlug}
          />
        </div>
      </div>
      <div className="bg-card border-border min-h-[320px] flex-1 space-y-3 rounded-lg border p-3">
        {messages.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Say something to start. Guests get limited free messages per
            character.
          </p>
        ) : null}
        {messages.map((m) => (
          <div className="space-y-1" key={m.id}>
            <div className="text-muted-foreground text-xs uppercase">
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
          <p className="text-muted-foreground text-xs">Thinking…</p>
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
