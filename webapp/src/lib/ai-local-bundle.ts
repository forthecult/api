/** Keys used by /chat and related UI (localStorage). */
export const AI_KEY_PREFIX = "culture-ai-";

/** Legacy prefix — only referenced by `migrateLegacyAiKeys`. */
const LEGACY_AI_KEY_PREFIX = "ftc-ai-";
const LEGACY_MIGRATION_SENTINEL = "culture-ai-migrated-from-ftc";

export interface AiLocalExportFile {
  exportedAt: string;
  localStorage: Record<string, string>;
  version: 1;
}

/** Replace all `culture-ai-*` keys with the snapshot (does not touch other site keys). */
export function applyAiLocalStorageSnapshot(
  snapshot: Record<string, string>,
): void {
  clearAiLocalStorageOnly();
  for (const [k, v] of Object.entries(snapshot)) {
    if (!k.startsWith(AI_KEY_PREFIX)) continue;
    try {
      localStorage.setItem(k, v);
    } catch {
      /* quota */
    }
  }
}

export function buildAiExportPayload(): AiLocalExportFile {
  return {
    exportedAt: new Date().toISOString(),
    localStorage: collectAiLocalStorageSnapshot(),
    version: 1,
  };
}

/** Remove only Culture AI chat keys from localStorage. */
export function clearAiLocalStorageOnly(): void {
  if (typeof window === "undefined") return;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(AI_KEY_PREFIX)) toRemove.push(k);
  }
  for (const k of toRemove) localStorage.removeItem(k);
}

/** Collect every `culture-ai-*` localStorage entry (chats, projects, prefs, guest id, etc.). */
export function collectAiLocalStorageSnapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof window === "undefined") return out;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(AI_KEY_PREFIX)) continue;
    const v = localStorage.getItem(k);
    if (v != null) out[k] = v;
  }
  return out;
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function estimateAiLocalBytes(): number {
  const snap = collectAiLocalStorageSnapshot();
  let n = 0;
  for (const [k, v] of Object.entries(snap)) {
    n += k.length + v.length;
  }
  return n * 2;
}

/**
 * One-shot migration from the legacy `ftc-ai-*` prefix to `culture-ai-*`.
 * Runs at most once per browser (guarded by a sentinel). Safe to call on
 * every mount. Idempotent.
 */
export function migrateLegacyAiKeys(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(LEGACY_MIGRATION_SENTINEL) === "1") return;
    const toMigrate: [string, string][] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(LEGACY_AI_KEY_PREFIX)) continue;
      const v = localStorage.getItem(k);
      if (v != null) toMigrate.push([k, v]);
    }
    for (const [oldKey, value] of toMigrate) {
      const newKey = AI_KEY_PREFIX + oldKey.slice(LEGACY_AI_KEY_PREFIX.length);
      if (localStorage.getItem(newKey) == null) {
        localStorage.setItem(newKey, value);
      }
      localStorage.removeItem(oldKey);
    }
    localStorage.setItem(LEGACY_MIGRATION_SENTINEL, "1");
  } catch {
    /* best-effort */
  }
}
