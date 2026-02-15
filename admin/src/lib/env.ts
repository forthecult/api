declare global {
  interface Window {
    __MAIN_APP_URL?: string;
  }
}

export function getMainAppUrl(): string {
  if (typeof window !== "undefined" && window.__MAIN_APP_URL !== undefined) {
    return normalizeMainAppUrl(window.__MAIN_APP_URL);
  }
  const raw =
    process.env.NEXT_PUBLIC_MAIN_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  return normalizeMainAppUrl(raw ?? "");
}

/**
 * Main app URL for admin (links to store, API calls).
 * Falls back to NEXT_PUBLIC_APP_URL so you only need one main URL in .env.
 *
 * On the client we prefer window.__MAIN_APP_URL (injected by the server at request time)
 * so the URL is correct even when the host only provides env at runtime (e.g. Railway).
 *
 * - When unset or empty: returns "" so API calls use relative URLs (same origin).
 * - When set: returns absolute URL (adds https:// if missing).
 */
function normalizeMainAppUrl(raw: string): string {
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}
