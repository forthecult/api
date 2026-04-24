"use client";

import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Folder,
  LayoutGrid,
  Plus,
  Search,
  Sparkles,
  SquarePen,
  Star,
  Trash2,
  Unlink,
} from "lucide-react";
import Image from "next/image";
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
  favorite?: boolean;
  id: string;
  /** When set, this chat belongs to the project with this id. */
  projectId?: null | string;
  title: string;
  updatedAt: number;
}

interface ChatSidebarProps {
  characters: CharacterOption[];
  charactersError: null | string;
  collapsed: boolean;
  loadingCharacters: boolean;
  mainView: "chat" | "projects";
  onCollapseToggle: () => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
  onOpenCreateProject: () => void;
  onOpenProjectsView: () => void;
  onRemoveFromProject: (id: string) => void;
  onSelectCharacter: (c: CharacterOption) => void;
  onSelectProject: (id: null | string) => void;
  onSelectSession: (id: string) => void;
  onToggleFavorite: (id: string) => void;
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
  mainView,
  onCollapseToggle,
  onDeleteSession,
  onNewChat,
  onOpenCreateProject,
  onOpenProjectsView,
  onRemoveFromProject,
  onSelectCharacter,
  onSelectProject,
  onSelectSession,
  onToggleFavorite,
  projects,
  searchQuery,
  selectedCharacterSlug,
  selectedProjectId,
  sessionId,
  sessions,
  setSearchQuery,
}: ChatSidebarProps) {
  const projectChats = useMemo(() => {
    if (!selectedProjectId) return [];
    return sessions.filter((s) => s.projectId === selectedProjectId);
  }, [sessions, selectedProjectId]);

  const filteredProjectChats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = projectChats;
    if (q) list = list.filter((s) => s.title.toLowerCase().includes(q));
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [projectChats, searchQuery]);

  const historySessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = sessions;
    if (selectedProjectId) {
      list = list.filter((s) => s.projectId !== selectedProjectId);
    }
    if (q) list = list.filter((s) => s.title.toLowerCase().includes(q));
    return [...list].sort((a, b) => {
      if (Boolean(a.favorite) !== Boolean(b.favorite)) {
        return a.favorite ? -1 : 1;
      }
      return b.updatedAt - a.updatedAt;
    });
  }, [searchQuery, selectedProjectId, sessions]);

  return (
    <aside
      className={cn(
        `
          flex h-full shrink-0 flex-col border-r border-border bg-muted/20
          transition-[width]
        `,
        collapsed
          ? "w-[56px]"
          : `
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
                pointer-events-none absolute top-1/2 left-3 h-4 w-4
                -translate-y-1/2 text-muted-foreground
              `}
            />
            <Input
              aria-label="Search chats"
              className="h-10 pl-9 text-base"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats"
              value={searchQuery}
            />
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2">
        <div>
          {!collapsed ? (
            <p
              className={`
                mb-1.5 px-1 text-sm font-semibold tracking-wider
                text-muted-foreground uppercase
              `}
            >
              Chat
            </p>
          ) : null}
          <Button
            className={cn(
              "w-full justify-start gap-2 text-base",
              collapsed && `px-2`,
            )}
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
              <p
                className={cn(
                  `
                    text-sm font-semibold tracking-wider text-muted-foreground
                    uppercase
                  `,
                  mainView === "projects" && "text-primary",
                )}
              >
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
          {!collapsed ? (
            <Button
              className={cn(
                "mb-2 w-full justify-start gap-2 text-sm",
                mainView === "projects" && "bg-primary/10 font-medium",
              )}
              onClick={onOpenProjectsView}
              size="sm"
              type="button"
              variant="outline"
            >
              <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
              All projects
            </Button>
          ) : (
            <div className="flex justify-center pb-1">
              <Button
                onClick={onOpenProjectsView}
                size="icon"
                title="All projects"
                type="button"
                variant="ghost"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          )}
          {projects.length === 0 ? (
            !collapsed ? (
              <p className="px-2 text-sm text-muted-foreground">
                No projects yet.
              </p>
            ) : null
          ) : (
            <ul className="flex flex-col gap-0.5">
              {projects.map((p) => {
                const active =
                  selectedProjectId === p.id && mainView === "chat";
                return (
                  <li key={p.id}>
                    <button
                      className={cn(
                        `
                          flex w-full items-center gap-2 rounded-lg px-2 py-1.5
                          text-left text-base transition-colors
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
                        <span className="min-w-0 flex-1 truncate">
                          {p.name}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selectedProjectId && !collapsed ? (
          <div>
            <p
              className={`
                mb-1.5 px-1 text-sm font-semibold tracking-wider
                text-muted-foreground uppercase
              `}
            >
              Chats in project
            </p>
            {filteredProjectChats.length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground">
                No chats yet. Use New chat while this project is open.
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {filteredProjectChats.map((s) => (
                  <SessionRow
                    active={sessionId === s.id}
                    collapsed={collapsed}
                    key={s.id}
                    onDelete={() => onDeleteSession(s.id)}
                    onRemoveFromProject={() => onRemoveFromProject(s.id)}
                    onSelect={() => onSelectSession(s.id)}
                    onToggleFavorite={() => onToggleFavorite(s.id)}
                    session={s}
                    showRemoveFromProject
                  />
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <div>
          {!collapsed ? (
            <p
              className={`
                mb-1.5 px-1 text-sm font-semibold tracking-wider
                text-muted-foreground uppercase
              `}
            >
              Characters
            </p>
          ) : (
            <div className="flex justify-center py-1" title="Characters">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          {charactersError && !collapsed ? (
            <p className="px-2 text-sm text-destructive">{charactersError}</p>
          ) : null}
          {loadingCharacters && !collapsed ? (
            <p className="px-2 text-sm text-muted-foreground">Loading…</p>
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
                    <Image
                      alt=""
                      className="h-full w-full object-cover"
                      height={64}
                      src={c.image_url}
                      unoptimized
                      width={64}
                    />
                  ) : (
                    <div
                      className={`
                        flex h-full w-full items-center justify-center bg-muted
                        text-xs font-medium
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
            <Clock className="h-4 w-4 text-muted-foreground" />
            {!collapsed ? (
              <p
                className={`
                  text-sm font-semibold tracking-wider text-muted-foreground
                  uppercase
                `}
              >
                History
              </p>
            ) : null}
          </div>
          {historySessions.length === 0 ? (
            !collapsed ? (
              <p className="px-2 text-sm text-muted-foreground">
                {searchQuery.trim()
                  ? "No matching chats."
                  : "No chat history yet."}
              </p>
            ) : null
          ) : (
            <ul className="flex flex-col gap-0.5">
              {historySessions.map((s) => (
                <SessionRow
                  active={sessionId === s.id}
                  collapsed={collapsed}
                  key={s.id}
                  onDelete={() => onDeleteSession(s.id)}
                  onRemoveFromProject={() => onRemoveFromProject(s.id)}
                  onSelect={() => onSelectSession(s.id)}
                  onToggleFavorite={() => onToggleFavorite(s.id)}
                  session={s}
                  showRemoveFromProject={Boolean(s.projectId)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {!collapsed ? (
        <div className="border-t border-border p-2">
          <Button
            asChild
            className="w-full text-sm"
            size="default"
            variant="ghost"
          >
            <Link href="/dashboard/ai">Account &amp; memory</Link>
          </Button>
        </div>
      ) : null}
    </aside>
  );
}

function SessionRow({
  active,
  collapsed,
  onDelete,
  onRemoveFromProject,
  onSelect,
  onToggleFavorite,
  session,
  showRemoveFromProject,
}: {
  active: boolean;
  collapsed: boolean;
  onDelete: () => void;
  onRemoveFromProject: () => void;
  onSelect: () => void;
  onToggleFavorite: () => void;
  session: ChatSessionMeta;
  showRemoveFromProject: boolean;
}) {
  return (
    <li>
      <div
        className={cn(
          `
            group flex w-full items-start gap-0.5 rounded-lg px-1 py-1
            transition-colors
          `,
          active ? "bg-muted" : "hover:bg-muted/80",
        )}
      >
        <button
          className={cn(
            `
              min-w-0 flex-1 rounded-md px-1.5 py-1.5 text-left text-base
              transition-colors
            `,
            active ? "font-medium text-foreground" : "text-muted-foreground",
          )}
          onClick={onSelect}
          title={session.title}
          type="button"
        >
          {!collapsed ? (
            <span className="line-clamp-2 flex items-start gap-1">
              {session.favorite ? (
                <Star
                  aria-hidden
                  className={`
                    mt-0.5 h-3 w-3 shrink-0 fill-amber-400 text-amber-400
                  `}
                />
              ) : null}
              {session.title}
            </span>
          ) : (
            <span className="block truncate">
              {session.title.slice(0, 1) || "·"}
            </span>
          )}
        </button>
        {!collapsed ? (
          <div
            className={`
              flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity
              group-hover:opacity-100
              focus-within:opacity-100
            `}
          >
            <Button
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              size="icon"
              title={session.favorite ? "Unfavorite" : "Favorite"}
              type="button"
              variant="ghost"
            >
              <Star
                className={cn(
                  "h-3 w-3",
                  session.favorite
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground",
                )}
              />
            </Button>
            {showRemoveFromProject ? (
              <Button
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFromProject();
                }}
                size="icon"
                title="Remove from project"
                type="button"
                variant="ghost"
              >
                <Unlink className="h-3 w-3 text-muted-foreground" />
              </Button>
            ) : null}
            <Button
              className={`
                h-6 w-6 p-0 text-destructive
                hover:text-destructive
              `}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              size="icon"
              title="Delete chat"
              type="button"
              variant="ghost"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
