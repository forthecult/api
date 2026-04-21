import type { AiLocalExportFile } from "~/lib/ai-local-bundle";

import {
  applyAiLocalStorageSnapshot,
  buildAiExportPayload,
} from "~/lib/ai-local-bundle";

export interface AiFullExportFile {
  exportedAt: string;
  local: AiLocalExportFile;
  server: null | {
    agent: ExportedAgent;
    memories: ExportedMemory[];
  };
  version: 2;
}

export interface ExportedAgent {
  backupMode?: string;
  characterName?: null | string;
  characterSlug?: null | string;
  jsonSettings?: null | Record<string, unknown>;
  name?: null | string;
  userPrompt?: null | string;
  userRagEnabled?: boolean;
}

export interface ExportedMemory {
  category: null | string;
  content: string;
  id: string;
}

export async function applyAiFullImport(bundle: unknown): Promise<void> {
  if (!bundle || typeof bundle !== "object") throw new Error("Invalid file");
  const o = bundle as Record<string, unknown>;

  if (o.version === 1) {
    const ls = o.localStorage;
    if (!ls || typeof ls !== "object") throw new Error("Invalid v1 export");
    applyAiLocalStorageSnapshot(ls as Record<string, string>);
    return;
  }

  if (o.version === 2) {
    const v2 = o as unknown as AiFullExportFile;
    applyAiLocalStorageSnapshot(v2.local.localStorage);
    if (!v2.server) return;
    const a = v2.server.agent;
    const put = await fetch("/api/ai/agent", {
      body: JSON.stringify({
        backupMode: a.backupMode,
        characterName: a.characterName,
        characterSlug: a.characterSlug,
        jsonSettings: a.jsonSettings ?? undefined,
        name: a.name,
        userPrompt: a.userPrompt,
        userRagEnabled: a.userRagEnabled,
      }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    });
    if (!put.ok) throw new Error("Could not restore account settings");
    await deleteAllMemories();
    for (const m of v2.server.memories) {
      const r = await fetch("/api/ai/memories", {
        body: JSON.stringify({
          category: m.category ?? undefined,
          content: m.content,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!r.ok) throw new Error("Could not restore a memory");
    }
    return;
  }

  throw new Error("Unsupported export version");
}

export async function buildAiFullExport(): Promise<AiFullExportFile> {
  const local = buildAiExportPayload();
  let server: AiFullExportFile["server"] = null;
  try {
    const [agentRes, memRes] = await Promise.all([
      fetch("/api/ai/agent", { credentials: "include" }),
      fetch("/api/ai/memories", { credentials: "include" }),
    ]);
    if (agentRes.ok && memRes.ok) {
      const agentJson = (await agentRes.json()) as { agent?: ExportedAgent };
      const memJson = (await memRes.json()) as { memories?: ExportedMemory[] };
      const agent = agentJson.agent;
      if (agent) {
        server = {
          agent: {
            backupMode: agent.backupMode,
            characterName: agent.characterName,
            characterSlug: agent.characterSlug,
            jsonSettings: agent.jsonSettings ?? null,
            name: agent.name,
            userPrompt: agent.userPrompt,
            userRagEnabled: agent.userRagEnabled,
          },
          memories: (memJson.memories ?? []).map((m) => ({
            category: m.category,
            content: m.content,
            id: m.id,
          })),
        };
      }
    }
  } catch {
    server = null;
  }
  return {
    exportedAt: new Date().toISOString(),
    local,
    server,
    version: 2,
  };
}

async function deleteAllMemories(): Promise<void> {
  const res = await fetch("/api/ai/memories", { credentials: "include" });
  if (!res.ok) return;
  const data = (await res.json()) as { memories?: { id: string }[] };
  for (const m of data.memories ?? []) {
    await fetch(`/api/ai/memories/${m.id}`, {
      credentials: "include",
      method: "DELETE",
    });
  }
}
