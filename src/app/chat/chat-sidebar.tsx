"use client";

import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Folder,
  Plus,
  Search,
  Sparkles,
  SquarePen,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { cn } from "~/lib/cn";
import { Button } from "~/ui/primitives/button";
import { Input } from "~/ui/primitives/input";

export interface CharacterOption {
  description?: null | string;
  image_url: null | string;
  name: string;
  slug: string;
}

export interface ChatProject {
  createdAt: number;
  id: string;
  instructions: string;
  name: string;
}

export interface ChatSessionMeta {
  id: string;
  title: string;
  updatedAt: number;
}

interface ChatSidebarProps {
  characters: CharacterOption[];
  charactersError: null | string;
  collapsed: boolean;
  loadingCharacters: boolean;
  onCollapseToggle: () => void;
  onNewChat: () => void;
  onOpenCreateProject: () => void;
  onSelectCharacter: (c: CharacterOption) => void;
  onSelectProject: (id: null | string) => void;
  onSelectSession: (id: string) => void;
  projects: ChatProject[];
  searchQuery: string;
  selectedCharacterSlug: null | string;
  selectedProjectId: null | string;
  sessionId: string;
  sessions: ChatSessionMeta[];
  setSearchQuery: (q: string) => void;
}

export function ChatSidebar({
  characters,
  charactersError,
  collapsed,
  loadingCharacters,
  onCollapseToggle,
  onNewChat,
  onOpenCreateProject,
  onSelectCharacter,
  onSelectProject,
  onSelectSession,
  projects,
  searchQuery,
  selectedCharacterSlug,
  selectedProjectId,
  sessionId,
  sessions,
  setSearchQuery,
}: ChatSidebarProps) {
  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [searchQuery, sessions]);

  return (
    <aside
      className={cn(
        `
          flex h-full shrink-0 flex-col border-r border-border bg-muted/20
          transition-[width]
        `,
        collapsed ? "w-[56px]" : `
          w-[min(100%,280px)]
          sm:w-[280px]
        `,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1 border-b border-border/80 p-2",
          collapsed && "flex-col",
        )}
      >
        <Button
          className={cn(!collapsed && "mr-auto")}
          onClick={onCollapseToggle}
          size="icon"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          type="button"
          variant="ghost"
        >
          {collapsed ? (
            <ChevronRight aria-hidden className="h-4 w-4" />
          ) : (
            <ChevronLeft aria-hidden className="h-4 w-4" />
          )}
        </Button>
        {!collapsed ? (
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden
              className={`
                pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5
                -translate-y-1/2 text-muted-foreground
              `}
            />
            <Input
              aria-label="Search chats"
              className="h-9 pl-8 text-sm"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats"
              value={searchQuery}
            />
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-2">
        <div>
          {!collapsed ? (
            <p className={`
              mb-1.5 px-1 text-[10px] font-semibold tracking-wider
              text-muted-foreground uppercase
            `}>
              Chat
            </p>
          ) : null}
          <Button
            className={cn("w-full justify-start gap-2", collapsed && "px-2")}
            onClick={onNewChat}
            title="New chat"
            type="button"
            variant="outline"
          >
            <SquarePen className="h-4 w-4 shrink-0" />
            {!collapsed ? <span>New chat</span> : null}
          </Button>
        </div>

        <div>
          <div
            className={cn(
              "mb-1.5 flex items-center gap-1 px-1",
              collapsed && "justify-center",
            )}
          >
            {!collapsed ? (
              <p className={`
                text-[10px] font-semibold tracking-wider text-muted-foreground
                uppercase
              `}>
                Projects
              </p>
            ) : null}
            <Button
              className={cn("h-7 w-7", !collapsed && "ml-auto")}
              onClick={onOpenCreateProject}
              size="icon"
              title="New project"
              type="button"
              variant="ghost"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {projects.length === 0 ? (
            !collapsed ? (
              <p className="px-2 text-xs text-muted-foreground">No projects yet.</p>
            ) : null
          ) : (
            <ul className="space-y-0.5">
              {projects.map((p) => {
                const active = selectedProjectId === p.id;
                return (
                  <li key={p.id}>
                    <button
                      className={cn(
                        `
                          flex w-full items-center gap-2 rounded-lg px-2 py-1.5
                          text-left text-sm transition-colors
                        `,
                        active
                          ? "bg-primary/15 font-medium text-foreground"
                          : `
                            text-muted-foreground
                            hover:bg-muted/80 hover:text-foreground
                          `,
                        collapsed && "justify-center px-0",
                      )}
                      onClick={() => onSelectProject(active ? null : p.id)}
                      title={p.name}
                      type="button"
                    >
                      <Folder className="h-4 w-4 shrink-0 opacity-80" />
                      {!collapsed ? (
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          {!collapsed ? (
            <p className={`
              mb-1.5 px-1 text-[10px] font-semibold tracking-wider
              text-muted-foreground uppercase
            `}>
              Characters
            </p>
          ) : (
            <div className="flex justify-center py-1" title="Characters">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          {charactersError && !collapsed ? (
            <p className="px-2 text-xs text-destructive">{charactersError}</p>
          ) : null}
          {loadingCharacters && !collapsed ? (
            <p className="px-2 text-xs text-muted-foreground">Loading…</p>
          ) : null}
          <div
            className={cn(
              "grid gap-1.5",
              collapsed ? "grid-cols-1 place-items-center" : "grid-cols-4",
            )}
          >
            {characters.map((c) => {
              const active = selectedCharacterSlug === c.slug;
              return (
                <button
                  className={cn(
                    `
                      aspect-square overflow-hidden rounded-xl border
                      transition-all
                    `,
                    active
                      ? "border-primary ring-2 ring-primary"
                      : `
                        border-border
                        hover:opacity-90
                      `,
                  )}
                  key={c.slug}
                  onClick={() => onSelectCharacter(c)}
                  title={c.name}
                  type="button"
                >
                  {c.image_url ? (
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      height={64}
                      src={c.image_url}
                      width={64}
                    />
                  ) : (
                    <div
                      className={`
                        flex h-full w-full items-center justify-center bg-muted
                        text-[10px] font-medium
                      `}
                    >
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div
            className={cn(
              "mb-1.5 flex items-center gap-1 px-1",
              collapsed && "justify-center",
            )}
          >
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {!collapsed ? (
              <p className={`
                text-[10px] font-semibold tracking-wider text-muted-foreground
                uppercase
              `}>
                History
              </p>
            ) : null}
          </div>
          {filteredSessions.length === 0 ? (
            !collapsed ? (
              <p className="px-2 text-xs text-muted-foreground">
                {searchQuery.trim()
                  ? "No matching chats."
                  : "No chat history yet."}
              </p>
            ) : null
          ) : (
            <ul className="space-y-0.5">
              {filteredSessions.map((s) => {
                const active = sessionId === s.id;
                return (
                  <li key={s.id}>
                    <button
                      className={cn(
                        `
                          w-full rounded-lg px-2 py-1.5 text-left text-xs
                          transition-colors
                        `,
                        active
                          ? "bg-muted font-medium"
                          : `
                            text-muted-foreground
                            hover:bg-muted/80 hover:text-foreground
                          `,
                      )}
                      onClick={() => onSelectSession(s.id)}
                      title={s.title}
                      type="button"
                    >
                      {!collapsed ? (
                        <span className="line-clamp-2">{s.title}</span>
                      ) : (
                        <span className="block truncate">
                          {s.title.slice(0, 1) || "·"}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {!collapsed ? (
        <div className="border-t border-border p-2">
          <Button asChild className="w-full" size="sm" variant="ghost">
            <Link href="/dashboard/ai">Account &amp; memory</Link>
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
