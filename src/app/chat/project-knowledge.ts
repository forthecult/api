/** Local project knowledge: files (with extracted text when possible) and cloud links. */

export type CloudProvider =
  | "google"
  | "dropbox"
  | "microsoft"
  | "proton"
  | "other";

export type ProjectKnowledgeItem =
  | {
      addedAt: number;
      id: string;
      kind: "file";
      mimeType: string;
      name: string;
      /** True when the file is allowed but text could not be read in-browser (e.g. PDF). */
      needsExtraction: boolean;
      size: number;
      textContent: null | string;
    }
  | {
      addedAt: number;
      id: string;
      kind: "link";
      name: string;
      provider: CloudProvider;
      url: string;
    };

const STORAGE_KEY = "ftc-ai-project-knowledge-v1";

/** Blocked extensions (executables, installers, risky types). */
const BLOCKED_EXT = new Set([
  "exe",
  "dll",
  "msi",
  "bat",
  "cmd",
  "com",
  "scr",
  "app",
  "deb",
  "rpm",
  "dmg",
  "pkg",
  "apk",
  "ipa",
  "jar",
  "sh",
  "ps1",
  "vbs",
  "js",
  "mjs",
  "cjs",
  "wasm",
  "dylib",
  "so",
]);

/**
 * Document types suitable as knowledge (docs, sheets, slides, data, text).
 * Binary office/PDF are allowed; text may be extracted in-browser when possible.
 */
const ALLOWED_EXT = new Set([
  "pdf",
  "doc",
  "docx",
  "dot",
  "dotx",
  "xls",
  "xlsx",
  "xlsm",
  "csv",
  "tsv",
  "ppt",
  "pptx",
  "odt",
  "ods",
  "odp",
  "rtf",
  "txt",
  "md",
  "markdown",
  "html",
  "htm",
  "xml",
  "json",
  "yaml",
  "yml",
  "log",
  "tex",
  "epub",
]);

const MAX_TEXT_CHARS = 120_000;

function extension(filename: string): string {
  const i = filename.lastIndexOf(".");
  if (i < 0) return "";
  return filename.slice(i + 1).toLowerCase();
}

export function isKnowledgeFileAllowed(file: File): boolean {
  const ext = extension(file.name);
  if (ext && BLOCKED_EXT.has(ext)) return false;
  if (ext && ALLOWED_EXT.has(ext)) return true;
  const t = file.type.toLowerCase();
  if (t.startsWith("text/")) return true;
  if (
    t === "application/json" ||
    t === "application/xml" ||
    t.includes("csv") ||
    t.includes("pdf") ||
    t.includes("wordprocessingml") ||
    t.includes("msword") ||
    t.includes("spreadsheetml") ||
    t.includes("presentationml")
  ) {
    return true;
  }
  return false;
}

function loadStore(): Record<string, ProjectKnowledgeItem[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, ProjectKnowledgeItem[]>;
  } catch {
    return {};
  }
}

function saveStore(store: Record<string, ProjectKnowledgeItem[]>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function loadProjectKnowledge(projectId: string): ProjectKnowledgeItem[] {
  const s = loadStore();
  const list = s[projectId];
  return Array.isArray(list) ? list : [];
}

export function saveProjectKnowledge(
  projectId: string,
  items: ProjectKnowledgeItem[],
): void {
  const s = loadStore();
  s[projectId] = items;
  saveStore(s);
}

/** Best-effort text extraction for browser-readable formats. */
export async function extractKnowledgeText(
  file: File,
): Promise<{ needsExtraction: boolean; text: null | string }> {
  if (!isKnowledgeFileAllowed(file)) {
    throw new Error("This file type is not allowed for project knowledge.");
  }
  const ext = extension(file.name);
  const mime = file.type.toLowerCase();

  const tryText = (): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result;
        resolve(typeof r === "string" ? r : "");
      };
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsText(file);
    });

  if (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    ext === "csv" ||
    ext === "tsv" ||
    ext === "md" ||
    ext === "markdown" ||
    ext === "txt" ||
    ext === "html" ||
    ext === "htm" ||
    ext === "xml" ||
    ext === "json" ||
    ext === "log"
  ) {
    let text = await tryText();
    if (text.length > MAX_TEXT_CHARS) {
      text = `${text.slice(0, MAX_TEXT_CHARS)}\n\n[…truncated]`;
    }
    return { needsExtraction: false, text };
  }

  if (
    ext === "pdf" ||
    mime.includes("pdf") ||
    mime.includes("wordprocessingml") ||
    mime.includes("msword") ||
    mime.includes("spreadsheetml") ||
    mime.includes("presentationml") ||
    mime.includes("opendocument") ||
    ext === "doc" ||
    ext === "docx" ||
    ext === "xls" ||
    ext === "xlsx" ||
    ext === "ppt" ||
    ext === "pptx" ||
    ext === "odt" ||
    ext === "ods" ||
    ext === "odp" ||
    ext === "rtf"
  ) {
    return { needsExtraction: true, text: null };
  }

  return { needsExtraction: true, text: null };
}

export function serializeKnowledgeForPrompt(
  items: ProjectKnowledgeItem[],
): string {
  if (items.length === 0) return "";
  const parts: string[] = [];
  for (const it of items) {
    if (it.kind === "link") {
      const label =
        it.provider === "other"
          ? "Document link"
          : `${providerLabel(it.provider)} link`;
      parts.push(`### ${it.name} (${label})\n${it.url}`);
      continue;
    }
    if (it.textContent?.trim()) {
      parts.push(`### ${it.name}\n${it.textContent.trim()}`);
    } else if (it.needsExtraction) {
      parts.push(
        `### ${it.name}\n[File attached: text was not embedded. Prefer adding a share link to this document, or paste key excerpts into project instructions.]`,
      );
    }
  }
  return parts.join("\n\n");
}

function providerLabel(p: CloudProvider): string {
  switch (p) {
    case "google":
      return "Google Drive";
    case "dropbox":
      return "Dropbox";
    case "microsoft":
      return "Microsoft OneDrive";
    case "proton":
      return "Proton Drive";
    default:
      return "Cloud";
  }
}

export function guessProviderFromUrl(url: string): CloudProvider {
  const u = url.toLowerCase();
  if (u.includes("drive.google.com") || u.includes("docs.google.com"))
    return "google";
  if (u.includes("dropbox.com")) return "dropbox";
  if (
    u.includes("sharepoint.com") ||
    u.includes("onedrive.live.com") ||
    u.includes("1drv.ms")
  ) {
    return "microsoft";
  }
  if (u.includes("proton.me") || u.includes("protonmail.com")) return "proton";
  return "other";
}

export function isValidHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
