/**
 * Client-side guardrails for project knowledge URLs (links pasted by users).
 * Defense-in-depth: pair with server checks if URLs are fetched server-side.
 *
 * Keeping the list updated: review quarterly; block categories (localhost, RFC1918,
 * metadata, shorteners) vs individual sites; optional NEXT_PUBLIC_KNOWLEDGE_URL_ALLOWLIST
 * for enterprise overrides; log blocks server-side when implemented.
 */

const BLOCKED_HOST_SUFFIXES = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
] as const;

const BLOCKED_HOST_PATTERNS = [/^169\.254\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./] as const;

const BLOCKED_HOST_SUBSTRINGS = [
  ".local",
  ".internal",
  ".lan",
  "169.254.169.254",
] as const;

/** False for localhost, private IPs, and obvious internal hostnames. */
export function isUrlAllowedForProjectKnowledge(urlString: string): boolean {
  try {
    const u = new URL(urlString.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    return !hostnameBlocked(u.hostname);
  } catch {
    return false;
  }
}

function allowlistHosts(): Set<string> {
  const raw = process.env.NEXT_PUBLIC_KNOWLEDGE_URL_ALLOWLIST?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function extraBlockedHosts(): Set<string> {
  const raw = process.env.NEXT_PUBLIC_KNOWLEDGE_URL_BLOCKLIST?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function hostnameBlocked(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (allowlistHosts().has(h)) return false;
  if (extraBlockedHosts().has(h)) return true;
  for (const s of BLOCKED_HOST_SUFFIXES) {
    if (h === s || h.endsWith(`.${s}`)) return true;
  }
  for (const sub of BLOCKED_HOST_SUBSTRINGS) {
    if (h.includes(sub)) return true;
  }
  for (const re of BLOCKED_HOST_PATTERNS) {
    if (re.test(h)) return true;
  }
  return false;
}
