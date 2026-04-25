import type { ChatSessionMeta } from "~/app/chat/chat-sidebar";

export function mergeRemoteSessions(
  prev: ChatSessionMeta[],
  remote: { id: string; title: null | string; updatedAt: string }[],
): ChatSessionMeta[] {
  const prevById = new Map(prev.map((s) => [s.id, s]));
  const next: ChatSessionMeta[] = remote.map((c) => {
    const local = prevById.get(c.id);
    return {
      favorite: local?.favorite ?? false,
      id: c.id,
      projectId: local?.projectId ?? null,
      title: (c.title?.trim() || "Chat").slice(0, 120),
      updatedAt: new Date(c.updatedAt).getTime(),
    };
  });
  next.sort((a, b) => b.updatedAt - a.updatedAt);
  const seen = new Set(next.map((s) => s.id));
  const merged = [...next];
  for (const p of prev) {
    if (!seen.has(p.id)) merged.push(p);
  }
  merged.sort((a, b) => {
    if (Boolean(a.favorite) !== Boolean(b.favorite)) {
      return a.favorite ? -1 : 1;
    }
    return b.updatedAt - a.updatedAt;
  });
  return merged;
}

export function messageText(m: {
  parts?: { text?: string; type: string }[];
}): string {
  if (!m.parts?.length) return "";
  return m.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
}
