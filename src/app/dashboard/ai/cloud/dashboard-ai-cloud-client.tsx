"use client";

import { Loader2, MessageSquare, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useSession } from "~/lib/auth-client";
import { Button } from "~/ui/primitives/button";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

interface ConversationRow {
  characterSlug: null | string;
  createdAt: string;
  id: string;
  title: null | string;
  updatedAt: string;
}

interface RagChunkRow {
  contentPreview: string;
  createdAt: string;
  id: string;
  sourceLabel: null | string;
}

export function DashboardAiCloudClient() {
  const { data: session } = useSession();
  const signedIn = Boolean(session?.user?.id);

  const [busy, setBusy] = useState(false);
  const [chunks, setChunks] = useState<RagChunkRow[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});

  const loadAll = useCallback(async () => {
    if (!signedIn) return;
    setBusy(true);
    try {
      const [cRes, convRes] = await Promise.all([
        fetch("/api/ai/rag/chunks?limit=100", { credentials: "include" }),
        fetch("/api/ai/conversations", { credentials: "include" }),
      ]);
      if (cRes.ok) {
        const data = (await cRes.json()) as { chunks?: RagChunkRow[] };
        setChunks(data.chunks ?? []);
      }
      if (convRes.ok) {
        const data = (await convRes.json()) as {
          conversations?: ConversationRow[];
        };
        const list = data.conversations ?? [];
        setConversations(list);
        const next: Record<string, string> = {};
        for (const c of list) {
          next[c.id] = c.title?.trim() || "Chat";
        }
        setTitles(next);
      }
    } catch {
      toast.error("Could not load cloud data.");
    } finally {
      setBusy(false);
    }
  }, [signedIn]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const deleteChunk = async (id: string) => {
    if (!signedIn) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ai/rag/chunks/${encodeURIComponent(id)}`, {
        credentials: "include",
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      setChunks((prev) => prev.filter((c) => c.id !== id));
      toast.success("RAG chunk removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const deleteConversation = async (id: string) => {
    if (!signedIn) return;
    if (!window.confirm("Delete this saved conversation from the cloud?"))
      return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/ai/conversations/${encodeURIComponent(id)}`,
        { credentials: "include", method: "DELETE" },
      );
      if (!res.ok) throw new Error(await res.text());
      setConversations((prev) => prev.filter((c) => c.id !== id));
      toast.success("Conversation removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const saveTitle = async (id: string) => {
    if (!signedIn) return;
    const title = titles[id]?.trim() || "Chat";
    setBusy(true);
    try {
      const res = await fetch(
        `/api/ai/conversations/${encodeURIComponent(id)}`,
        {
          body: JSON.stringify({ title }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        },
      );
      if (!res.ok) throw new Error(await res.text());
      toast.success("Title saved.");
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  if (!signedIn) {
    return (
      <div
        className={`
          rounded-xl border border-border bg-card p-6 text-sm
          text-muted-foreground
        `}
      >
        Sign in to manage cloud RAG chunks and saved conversations.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cloud data</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Delete individual RAG chunks or whole saved chats. Upload new text
          from{" "}
          <a className="text-primary underline" href="/dashboard/ai/prompts">
            Prompts &amp; memory
          </a>
          .
        </p>
      </div>

      <section className="space-y-3">
        <h2
          className={`
            text-xs font-semibold tracking-wide text-muted-foreground uppercase
          `}
        >
          RAG chunks
        </h2>
        <div className="rounded-xl border border-border bg-card p-4">
          {busy && chunks.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : chunks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No chunks yet.</p>
          ) : (
            <ul className="space-y-3">
              {chunks.map((c) => (
                <li
                  className={`
                    flex flex-col gap-2 rounded-lg border border-border/80 p-3
                    sm:flex-row sm:items-start sm:justify-between
                  `}
                  key={c.id}
                >
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {c.sourceLabel ? `${c.sourceLabel} · ` : null}
                      {new Date(c.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm whitespace-pre-wrap">
                      {c.contentPreview}
                    </p>
                    <p
                      className={`
                        mt-1 font-mono text-[10px] text-muted-foreground
                      `}
                    >
                      {c.id}
                    </p>
                  </div>
                  <Button
                    aria-label="Delete chunk"
                    className="shrink-0"
                    disabled={busy}
                    onClick={() => void deleteChunk(c.id)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2
          className={`
            text-xs font-semibold tracking-wide text-muted-foreground uppercase
          `}
        >
          Saved conversations
        </h2>
        <div className="rounded-xl border border-border bg-card p-4">
          {conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No cloud conversations yet. Open{" "}
              <a className="text-primary underline" href="/chat">
                /chat
              </a>{" "}
              while signed in to sync.
            </p>
          ) : (
            <ul className="space-y-4">
              {conversations.map((c) => (
                <li
                  className="rounded-lg border border-border/80 p-3"
                  key={c.id}
                >
                  <div
                    className={`
                      flex flex-col gap-3
                      sm:flex-row sm:items-end sm:justify-between
                    `}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label className="text-xs" htmlFor={`title-${c.id}`}>
                        Title
                      </Label>
                      <Input
                        disabled={busy}
                        id={`title-${c.id}`}
                        onChange={(e) =>
                          setTitles((prev) => ({
                            ...prev,
                            [c.id]: e.target.value,
                          }))
                        }
                        value={titles[c.id] ?? ""}
                      />
                      <p className="text-xs text-muted-foreground">
                        <MessageSquare className="mr-1 inline h-3 w-3" />
                        Updated {new Date(c.updatedAt).toLocaleString()}
                        {c.characterSlug ? ` · ${c.characterSlug}` : null}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {c.id}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        disabled={busy}
                        onClick={() => void saveTitle(c.id)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Save title
                      </Button>
                      <Button
                        disabled={busy}
                        onClick={() => void deleteConversation(c.id)}
                        size="sm"
                        type="button"
                        variant="destructive"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
