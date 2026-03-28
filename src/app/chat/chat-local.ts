import type { UIMessage } from "ai";

import type { ChatProject, ChatSessionMeta } from "~/app/chat/chat-sidebar";

const KEY_PROJECTS = "ftc-ai-projects";
const KEY_SESSIONS = "ftc-ai-session-list";
const KEY_SIDEBAR = "ftc-ai-sidebar-collapsed";

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

export function loadSessionList(): ChatSessionMeta[] {
  try {
    const raw = localStorage.getItem(KEY_SESSIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is ChatSessionMeta =>
        s != null &&
        typeof s === "object" &&
        typeof (s as ChatSessionMeta).id === "string" &&
        typeof (s as ChatSessionMeta).title === "string",
    );
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
  return `ftc-ai-messages-${sessionId}`;
}
