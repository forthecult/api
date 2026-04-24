import type { UIMessage } from "ai";

import type { ChatProject, ChatSessionMeta } from "~/app/chat/chat-sidebar";

const KEY_PROJECTS = "culture-ai-projects";
const KEY_SESSIONS = "culture-ai-session-list";
const KEY_SIDEBAR = "culture-ai-sidebar-collapsed";
const KEY_PROJECT_SETTINGS_PANEL =
  "culture-ai-project-settings-panel-collapsed";

export function loadProjects(): ChatProject[] {
  try {
    const raw = localStorage.getItem(KEY_PROJECTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is ChatProject =>
        p != null &&
        typeof p === "object" &&
        typeof (p as ChatProject).id === "string" &&
        typeof (p as ChatProject).name === "string",
    );
  } catch {
    return [];
  }
}

/** When true, the desktop project settings column is hidden. */
export function loadProjectSettingsPanelCollapsed(): boolean {
  try {
    return localStorage.getItem(KEY_PROJECT_SETTINGS_PANEL) === "1";
  } catch {
    return false;
  }
}

export function loadSessionList(): ChatSessionMeta[] {
  try {
    const raw = localStorage.getItem(KEY_SESSIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s) => normalizeSession(s))
      .filter((s): s is ChatSessionMeta => s != null);
  } catch {
    return [];
  }
}

export function loadSessionMessages(sessionId: string): null | UIMessage[] {
  try {
    const raw = localStorage.getItem(messagesKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as UIMessage[];
  } catch {
    return null;
  }
}

export function loadSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(KEY_SIDEBAR) === "1";
  } catch {
    return false;
  }
}

export function saveProjects(projects: ChatProject[]): void {
  try {
    localStorage.setItem(KEY_PROJECTS, JSON.stringify(projects));
  } catch {
    /* ignore */
  }
}

export function saveProjectSettingsPanelCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(KEY_PROJECT_SETTINGS_PANEL, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function saveSessionList(sessions: ChatSessionMeta[]): void {
  try {
    localStorage.setItem(KEY_SESSIONS, JSON.stringify(sessions));
  } catch {
    /* ignore */
  }
}

export function saveSessionMessages(
  sessionId: string,
  messages: UIMessage[],
): void {
  try {
    localStorage.setItem(messagesKey(sessionId), JSON.stringify(messages));
  } catch {
    /* ignore */
  }
}

export function saveSidebarCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(KEY_SIDEBAR, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function messagesKey(sessionId: string): string {
  return `culture-ai-messages-${sessionId}`;
}

function normalizeSession(raw: unknown): ChatSessionMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== "string" || typeof s.title !== "string") return null;
  const updatedAt =
    typeof s.updatedAt === "number" && Number.isFinite(s.updatedAt)
      ? s.updatedAt
      : Date.now();
  const projectId =
    typeof s.projectId === "string" && s.projectId.trim()
      ? s.projectId.trim()
      : null;
  return {
    favorite: Boolean(s.favorite),
    id: s.id,
    projectId,
    title: s.title,
    updatedAt,
  };
}
