"use client";

import { useChat } from "@ai-sdk/react";
import {
  convertFileListToFileUIParts,
  DefaultChatTransport,
  type UIMessage,
} from "ai";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  loadProjects,
  loadSessionList,
  loadSessionMessages,
  loadSidebarCollapsed,
  saveProjects,
  saveSessionList,
  saveSessionMessages,
  saveSidebarCollapsed,
} from "~/app/chat/chat-local";
import {
  type ChatProject,
  type ChatSessionMeta,
  ChatSidebar,
} from "~/app/chat/chat-sidebar";
import { useSession } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
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
import { Label } from "~/ui/primitives/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/ui/primitives/popover";
import { Slider } from "~/ui/primitives/slider";

const GUEST_KEY = "ftc-ai-guest-id";
const TEMP_KEY = "ftc-ai-temperature";
const TOP_P_KEY = "ftc-ai-top-p";
const USE_TOP_P_KEY = "ftc-ai-use-top-p";

interface AiCharacter {
  description?: null | string;
  image_url: null | string;
  name: string;
  slug: string;
}

export function ChatPageClient() {
  const { data: sessionData } = useSession();
  const userId = sessionData?.user?.id ?? null;

  const [guestId, setGuestId] = useState("");
  const [input, setInput] = useState("");
  const [characters, setCharacters] = useState<AiCharacter[]>([]);
  const [charactersError, setCharactersError] = useState<null | string>(null);
  const [loadingCharacters, setLoadingCharacters] = useState(true);

  const [characterSlug, setCharacterSlug] = useState("default");
  const [selectedMeta, setSelectedMeta] = useState<AiCharacter | null>(null);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.95);
  const [useTopP, setUseTopP] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<ChatProject[]>([]);
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<null | string>(
    null,
  );
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectInstructions, setNewProjectInstructions] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const skipNextPersistRef = useRef(false);

  useEffect(() => {
    try {
      setSidebarCollapsed(loadSidebarCollapsed());
    } catch {
      /* ignore */
    }
  }, []);

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
    // eslint-disable-next-line @eslint-react/set-state-in-effect -- localStorage-backed guest id
    setGuestId(getOrCreateGuestId());
  }, []);

  useEffect(() => {
    try {
      setProjects(loadProjects());
      setSessions(loadSessionList());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await fetchJson<{ data?: AiCharacter[] }>(
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
          agent?: { characterName: null | string; characterSlug: null | string };
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
        const detail = parseCharacterDetail(rawDetail);
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

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const persistAgentCharacter = useCallback(
    async (next: AiCharacter | null) => {
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
    async (c: AiCharacter | null) => {
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
          projectInstructions: selectedProject?.instructions ?? undefined,
          ...(useTopP ? { topP } : { temperature }),
        },
        credentials: "include",
        headers: {
          "x-ai-guest-id": guestId,
        },
      }),
    [
      characterSlug,
      guestId,
      selectedProject?.instructions,
      temperature,
      topP,
      useTopP,
    ],
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

  useEffect(() => {
    skipNextPersistRef.current = true;
    try {
      const loaded = loadSessionMessages(sessionId);
      setMessages(loaded ?? []);
    } catch {
      setMessages([]);
    }
  }, [sessionId, setMessages]);

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    saveSessionMessages(sessionId, messages);
  }, [messages, sessionId]);

  const upsertSessionTitle = useCallback(
    (id: string, title: string) => {
      const now = Date.now();
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        next.unshift({ id, title: title.slice(0, 120), updatedAt: now });
        next.sort((a, b) => b.updatedAt - a.updatedAt);
        saveSessionList(next);
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (messages.length === 0) return;
    const firstUser = messages.find((m) => m.role === "user");
    if (!firstUser) return;
    const t = messageText(firstUser).trim() || "Chat";
    upsertSessionTitle(sessionId, t);
  }, [messages, sessionId, upsertSessionTitle]);

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
    toast.message("New chat");
  };

  const handleSelectSession = (id: string) => {
    if (id === sessionId) return;
    setSessionId(id);
    const loaded = loadSessionMessages(id);
    setMessages(loaded ?? []);
    clearError();
  };

  const deleteAssistantMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const startSpeech = () => {
    type RecognitionCtor = new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      maxAlternatives: number;
      onerror: ((ev: Event) => void) | null;
      onresult: ((ev: Event) => void) | null;
      start: () => void;
    };
    const w = window as unknown as {
      SpeechRecognition?: RecognitionCtor;
      webkitSpeechRecognition?: RecognitionCtor;
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
    recognition.continuous = false;
    recognition.onresult = (ev: Event) => {
      const res = ev as unknown as {
        results?: { transcript?: string }[][];
      };
      const r = res.results?.[0]?.[0];
      const transcript = r?.transcript?.trim();
      if (transcript)
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = (ev: Event) => {
      const code = (ev as unknown as { error?: string }).error ?? "unknown";
      if (code === "aborted") return;
      if (code === "not-allowed")
        toast.error(
          "Microphone or speech recognition was blocked. Check browser permissions.",
        );
      else if (code === "no-speech")
        toast.message("No speech detected—try again.");
      else toast.error(`Speech recognition: ${code}`);
    };
    try {
      recognition.start();
      toast.message("Listening… speak now.");
    } catch {
      toast.error("Could not start speech recognition.");
    }
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = "";
    if (!files?.length) return;
    let fileParts: Awaited<ReturnType<typeof convertFileListToFileUIParts>>;
    try {
      fileParts = await convertFileListToFileUIParts(files);
    } catch {
      toast.error("Could not read images.");
      return;
    }
    const text = input.trim();
    const parts: (| (typeof fileParts)[number]
      | { text: string; type: "text" })[] = [...fileParts];
    if (text) parts.push({ text, type: "text" });
    void sendMessage({ parts, role: "user" });
    setInput("");
  };

  const createProject = () => {
    const name = newProjectName.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    const p: ChatProject = {
      createdAt: Date.now(),
      id,
      instructions: newProjectInstructions.trim(),
      name,
    };
    const next = [...projects, p];
    setProjects(next);
    saveProjects(next);
    setSelectedProjectId(id);
    setProjectDialogOpen(false);
    setNewProjectName("");
    setNewProjectInstructions("");
    toast.success("Project created");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, busy]);

  return (
    <div className={`
      flex h-[min(100dvh,100vh)] max-h-[100dvh] w-full overflow-hidden
      bg-background
    `}>
      <ChatSidebar
        characters={characters}
        charactersError={charactersError}
        collapsed={sidebarCollapsed}
        loadingCharacters={loadingCharacters}
        onCollapseToggle={() => {
          const next = !sidebarCollapsed;
          setSidebarCollapsed(next);
          saveSidebarCollapsed(next);
        }}
        onNewChat={newChat}
        onOpenCreateProject={() => setProjectDialogOpen(true)}
        onSelectCharacter={(c) => void selectCharacter(c)}
        onSelectProject={setSelectedProjectId}
        onSelectSession={handleSelectSession}
        projects={projects}
        searchQuery={searchQuery}
        selectedCharacterSlug={selectedMeta?.slug ?? null}
        selectedProjectId={selectedProjectId}
        sessionId={sessionId}
        sessions={sessions}
        setSearchQuery={setSearchQuery}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className={`
          flex shrink-0 items-center justify-between gap-2 border-b
          border-border px-4 py-3
        `}>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              Chat
            </h1>
            {selectedProject ? (
              <p className="truncate text-xs text-muted-foreground">
                Project: {selectedProject.name}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" type="button" variant="ghost">
                  <Settings2 aria-hidden className="h-4 w-4" />
                  <span className="sr-only">Model settings</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <div className="space-y-3">
                  <p className="text-sm font-medium">Sampling</p>
                  <label className={`
                    flex cursor-pointer items-center gap-2 text-sm
                  `}>
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
                </div>
              </PopoverContent>
            </Popover>
            <Button
              onClick={newChat}
              size="sm"
              type="button"
              variant="outline"
            >
              <Plus aria-hidden className="mr-1 h-4 w-4" />
              New
            </Button>
            {userId ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/ai">Account</Link>
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </header>

        {error ? (
          <div
            className={`
              mx-4 mt-2 rounded-lg border border-destructive/40
              bg-destructive/10 px-4 py-3 text-sm text-destructive
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

        <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.length === 0 ? (
              <div className={`
                flex flex-col items-center justify-center gap-2 py-16
                text-center
              `}>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Start a conversation. Your messages stay private to this
                  browser unless you use account backups.
                </p>
              </div>
            ) : null}
            {messages.map((m) => {
              const isUser = m.role === "user";
              const isAssistant = m.role === "assistant";
              const text = isAssistant ? messageText(m) : "";
              return (
                <div
                  className={cn(
                    "flex w-full",
                    isUser ? "justify-end" : "justify-start",
                  )}
                  key={m.id}
                >
                  <div
                    className={cn(
                      `
                        max-w-[min(100%,85%)] rounded-2xl px-4 py-3 text-sm
                        shadow-sm
                      `,
                      isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {isUser ? (
                      <MessageParts message={m} />
                    ) : (
                      <div className="space-y-2 whitespace-pre-wrap">{text}</div>
                    )}
                    {isAssistant && text ? (
                      <div className={`
                        mt-2 flex flex-wrap gap-1 border-t border-border/50 pt-2
                        opacity-90
                      `}>
                        <Button
                          className="h-7 px-2 text-xs"
                          onClick={() => void copyText(text)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          <Copy aria-hidden className="mr-1 h-3 w-3" />
                          Copy
                        </Button>
                        {m.id === lastAssistantId ? (
                          <Button
                            className="h-7 px-2 text-xs"
                            disabled={busy}
                            onClick={() => void regenerate()}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            <RotateCcw aria-hidden className="mr-1 h-3 w-3" />
                            Regenerate
                          </Button>
                        ) : null}
                        <Button
                          className={`
                            h-7 px-2 text-xs text-destructive
                            hover:text-destructive
                          `}
                          onClick={() => deleteAssistantMessage(m.id)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 aria-hidden className="mr-1 h-3 w-3" />
                          Remove
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {busy ? (
              <div className={`
                flex items-center gap-2 text-sm text-muted-foreground
              `}>
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                Thinking…
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className={`
          shrink-0 border-t border-border/80 bg-background/95 p-4 backdrop-blur
          supports-[backdrop-filter]:bg-background/80
        `}>
          <div className="mx-auto w-full max-w-3xl">
            <input
              accept="image/*"
              className="hidden"
              onChange={onPickImage}
              ref={fileInputRef}
              type="file"
            />
            <form
              className={`
                rounded-2xl border border-border/80 bg-muted/30 p-2 shadow-sm
              `}
              onSubmit={onSubmit}
            >
              <textarea
                className={cn(
                  "border-input bg-transparent",
                  "placeholder:text-muted-foreground",
                  "min-h-[48px] w-full resize-none px-3 py-2 text-sm",
                  "rounded-xl border-0 border-transparent",
                  `
                    ring-0 outline-none
                    focus:ring-0
                    focus-visible:ring-0 focus-visible:outline-none
                  `,
                )}
                disabled={busy}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Send a private message…"
                rows={2}
                value={input}
              />
              <div className="flex items-center justify-between gap-2 px-1 pb-1">
                <div className="flex items-center gap-1">
                  <Button
                    disabled={busy}
                    onClick={startSpeech}
                    size="icon"
                    title="Dictate"
                    type="button"
                    variant="ghost"
                  >
                    <Mic aria-hidden className="h-4 w-4" />
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                    size="icon"
                    title="Attach image"
                    type="button"
                    variant="ghost"
                  >
                    <ImageIcon aria-hidden className="h-4 w-4" />
                  </Button>
                  {busy ? (
                    <Button
                      onClick={() => stop()}
                      size="sm"
                      type="button"
                      variant="destructive"
                    >
                      <Square aria-hidden className="mr-1 h-3.5 w-3.5" />
                      Stop
                    </Button>
                  ) : null}
                </div>
                <Button
                  disabled={busy || !input.trim()}
                  size="sm"
                  type="submit"
                >
                  Send
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <Dialog onOpenChange={setProjectDialogOpen} open={projectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create new project</DialogTitle>
            <DialogDescription>
              Projects keep related chats and instructions in one place. The
              assistant will follow your project instructions when this project
              is selected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="proj-name">Name</Label>
              <Input
                id="proj-name"
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Holiday planner"
                value={newProjectName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-inst">Project instructions (optional)</Label>
              <textarea
                className={cn(
                  "border-input bg-background ring-offset-background",
                  "placeholder:text-muted-foreground",
                  "min-h-[88px] w-full rounded-md border px-3 py-2 text-sm",
                  `
                    focus-visible:ring-2 focus-visible:ring-ring
                    focus-visible:ring-offset-2
                  `,
                  "focus-visible:outline-none",
                )}
                id="proj-inst"
                onChange={(e) => setNewProjectInstructions(e.target.value)}
                placeholder="Tone, style, and goals for this project."
                value={newProjectInstructions}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setProjectDialogOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={!newProjectName.trim()}
              onClick={createProject}
              type="button"
            >
              Create project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function MessageParts({ message }: { message: UIMessage }) {
  const parts = message.parts ?? [];
  if (parts.length === 0) return null;
  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.type === "text" && "text" in part) {
          const tx = typeof part.text === "string" ? part.text : "";
          return (
            <div className="whitespace-pre-wrap" key={i}>
              {tx}
            </div>
          );
        }
        if (part.type === "file") {
          const url =
            "url" in part && typeof part.url === "string" ? part.url : null;
          const mt =
            "mediaType" in part && typeof part.mediaType === "string"
              ? part.mediaType
              : "";
          if (url && mt.startsWith("image/")) {
            return (
              <img
                alt=""
                className="max-h-52 max-w-full rounded-lg object-contain"
                key={i}
                src={url}
              />
            );
          }
        }
        return null;
      })}
    </div>
  );
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

function parseCharacterDetail(json: unknown): AiCharacter | null {
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
