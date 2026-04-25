"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { loadProjects } from "~/app/chat/chat-local";
import { useSession } from "~/lib/auth-client";
import { Button } from "~/ui/primitives/button";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

interface MemoryRow {
  category: null | string;
  content: string;
  id: string;
}

export function DashboardAiPromptsClient() {
  const { data: session } = useSession();
  const signedIn = Boolean(session?.user?.id);

  const [userPrompt, setUserPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [newMemContent, setNewMemContent] = useState("");
  const [newMemCategory, setNewMemCategory] = useState("");
  const [editingId, setEditingId] = useState<null | string>(null);
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [ragBusy, setRagBusy] = useState(false);
  const [ragLabel, setRagLabel] = useState("");
  const [ragText, setRagText] = useState("");
  const loadAgent = useCallback(async () => {
    if (!signedIn) return;
    try {
      const res = await fetch("/api/ai/agent", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        agent?: { userPrompt?: null | string };
      };
      setUserPrompt(data.agent?.userPrompt?.trim() ?? "");
    } catch {
      /* ignore */
    }
  }, [signedIn]);

  const loadMemories = useCallback(async () => {
    if (!signedIn) return;
    try {
      const res = await fetch("/api/ai/memories", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { memories?: MemoryRow[] };
      setMemories(data.memories ?? []);
    } catch {
      /* ignore */
    }
  }, [signedIn]);

  const projectsPreview = useMemo(() => {
    try {
      return JSON.stringify(loadProjects(), null, 2);
    } catch {
      return "[]";
    }
  }, []);

  useEffect(() => {
    void loadAgent();
    void loadMemories();
  }, [loadAgent, loadMemories]);

  const savePrompt = async () => {
    if (!signedIn) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ai/agent", {
        body: JSON.stringify({ userPrompt: userPrompt.trim() || null }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Custom prompt saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addMemory = async () => {
    if (!signedIn) return;
    const content = newMemContent.trim();
    if (!content) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ai/memories", {
        body: JSON.stringify({
          category: newMemCategory.trim() || undefined,
          content,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      setNewMemContent("");
      setNewMemCategory("");
      toast.success("Context added.");
      await loadMemories();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add");
    } finally {
      setSaving(false);
    }
  };

  const deleteMemory = async (id: string) => {
    if (!signedIn) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ai/memories/${id}`, {
        credentials: "include",
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      setMemories((prev) => prev.filter((m) => m.id !== id));
      toast.success("Removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  const startEditMemory = (m: MemoryRow) => {
    setEditingId(m.id);
    setEditContent(m.content);
    setEditCategory(m.category ?? "");
  };

  const cancelEditMemory = () => {
    setEditingId(null);
    setEditContent("");
    setEditCategory("");
  };

  const saveEditMemory = async () => {
    if (!signedIn || !editingId) return;
    const content = editContent.trim();
    if (!content) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ai/memories/${editingId}`, {
        body: JSON.stringify({
          category: editCategory.trim() || null,
          content,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Memory updated.");
      cancelEditMemory();
      await loadMemories();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const uploadRagDocument = async () => {
    if (!signedIn) return;
    const text = ragText.trim();
    if (!text) {
      toast.error("Paste text or use a file.");
      return;
    }
    setRagBusy(true);
    try {
      const res = await fetch("/api/ai/rag/documents", {
        body: JSON.stringify({
          sourceLabel: ragLabel.trim() || undefined,
          text,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      setRagText("");
      setRagLabel("");
      toast.success("Document chunked and indexed for your account.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setRagBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Prompts &amp; memory
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Custom instructions and long-term context are stored on your account
          and used when you chat while signed in. Project instructions stay in
          your browser (see below).
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2
          className={`
            text-xs font-semibold tracking-wide text-muted-foreground uppercase
          `}
        >
          Custom prompt
        </h2>
        <div className="rounded-xl border border-border bg-card p-4">
          <Label className="text-sm" htmlFor="user-prompt">
            Instructions for your assistant
          </Label>
          <textarea
            className={`
              mt-2 min-h-[120px] w-full rounded-md border border-input
              bg-background px-3 py-2 text-sm ring-offset-background
              placeholder:text-muted-foreground
              focus-visible:ring-2 focus-visible:ring-ring
              focus-visible:ring-offset-2 focus-visible:outline-none
            `}
            disabled={!signedIn || saving}
            id="user-prompt"
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="How you want replies to sound, what to prioritize, boundaries…"
            value={userPrompt}
          />
          <Button
            className="mt-3"
            disabled={!signedIn || saving}
            onClick={() => void savePrompt()}
            type="button"
          >
            Save prompt
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2
          className={`
            text-xs font-semibold tracking-wide text-muted-foreground uppercase
          `}
        >
          Contexts (memories)
        </h2>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Short notes the model can retrieve (RAG, for the techies) when
            relevant. Delete or add anytime.
          </p>
          <div
            className={`
              mb-4 flex flex-col gap-2
              sm:flex-row sm:items-end
            `}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Label className="text-xs" htmlFor="mem-cat">
                Category (optional)
              </Label>
              <Input
                disabled={!signedIn || saving}
                id="mem-cat"
                onChange={(e) => setNewMemCategory(e.target.value)}
                placeholder="e.g. work, health"
                value={newMemCategory}
              />
            </div>
            <div className="flex min-w-0 flex-[2] flex-col gap-1">
              <Label className="text-xs" htmlFor="mem-body">
                Content
              </Label>
              <Input
                disabled={!signedIn || saving}
                id="mem-body"
                onChange={(e) => setNewMemContent(e.target.value)}
                placeholder="Fact or preference to remember"
                value={newMemContent}
              />
            </div>
            <Button
              disabled={!signedIn || saving}
              onClick={() => void addMemory()}
              type="button"
              variant="outline"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>
          <ul className="flex flex-col gap-2">
            {memories.length === 0 ? (
              <li className="text-sm text-muted-foreground">
                No contexts yet.
              </li>
            ) : (
              memories.map((m) => (
                <li
                  className={`
                    flex flex-col gap-2 rounded-lg border border-border/80 p-3
                    sm:flex-row sm:items-start sm:justify-between
                  `}
                  key={m.id}
                >
                  <div className="min-w-0">
                    {editingId === m.id ? (
                      <div className="flex flex-col gap-2">
                        <Input
                          disabled={saving}
                          onChange={(e) => setEditCategory(e.target.value)}
                          placeholder="Category (optional)"
                          value={editCategory}
                        />
                        <textarea
                          className={`
                            min-h-[88px] w-full rounded-md border border-input
                            bg-background px-3 py-2 text-sm
                            focus-visible:ring-2 focus-visible:ring-ring
                            focus-visible:outline-none
                          `}
                          disabled={saving}
                          onChange={(e) => setEditContent(e.target.value)}
                          value={editContent}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            disabled={saving}
                            onClick={() => void saveEditMemory()}
                            size="sm"
                            type="button"
                          >
                            Save
                          </Button>
                          <Button
                            disabled={saving}
                            onClick={cancelEditMemory}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {m.category ? (
                          <span
                            className={`
                              text-xs font-medium text-muted-foreground
                            `}
                          >
                            {m.category}
                          </span>
                        ) : null}
                        <p className="mt-1 text-sm whitespace-pre-wrap">
                          {m.content}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {editingId === m.id ? null : (
                      <Button
                        className="shrink-0"
                        disabled={saving}
                        onClick={() => startEditMemory(m)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      className="shrink-0"
                      disabled={saving}
                      onClick={() => void deleteMemory(m.id)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2
          className={`
            text-xs font-semibold tracking-wide text-muted-foreground uppercase
          `}
        >
          RAG documents (your account)
        </h2>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Paste text to chunk and embed into your private retrieval index. For{" "}
            <strong>images / vision</strong>, attach files in{" "}
            <a className="text-primary underline" href="/chat">
              /chat
            </a>{" "}
            — the vision model reads image parts there; this uploader is
            text-only.
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs" htmlFor="rag-label">
                Source label (optional)
              </Label>
              <Input
                disabled={!signedIn || ragBusy}
                id="rag-label"
                onChange={(e) => setRagLabel(e.target.value)}
                placeholder="e.g. Notes Q1"
                value={ragLabel}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs" htmlFor="rag-body">
                Text
              </Label>
              <textarea
                className={`
                  min-h-[120px] w-full rounded-md border border-input
                  bg-background px-3 py-2 text-sm
                  focus-visible:ring-2 focus-visible:ring-ring
                  focus-visible:outline-none
                `}
                disabled={!signedIn || ragBusy}
                id="rag-body"
                onChange={(e) => setRagText(e.target.value)}
                placeholder="Paste document text…"
                value={ragText}
              />
            </div>
            <Button
              disabled={!signedIn || ragBusy || !ragText.trim()}
              onClick={() => void uploadRagDocument()}
              type="button"
            >
              {ragBusy ? "Indexing…" : "Upload to RAG"}
            </Button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2
          className={`
            text-xs font-semibold tracking-wide text-muted-foreground uppercase
          `}
        >
          Project contexts (browser)
        </h2>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-sm text-muted-foreground">
            Projects you create in /chat are stored locally. Export or cloud
            backup from{" "}
            <a className="text-primary underline" href="/dashboard/ai/storage">
              Storage &amp; data
            </a>{" "}
            to preserve them across devices.
          </p>
          <pre
            className={`
              max-h-64 overflow-auto rounded-lg bg-muted/50 p-3 text-xs
            `}
          >
            {projectsPreview}
          </pre>
        </div>
      </section>
    </div>
  );
}
