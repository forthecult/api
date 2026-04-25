/**
 * Centralized app URL helpers for customer-facing and server code.
 * Use these instead of repeating env checks across pages.
 */

const DEFAULT_SERVER = "http://localhost:3000";
const DEFAULT_PUBLIC_SITE = "https://forthecult.store";

/**
 * Base URL for the agent-facing experience (e.g. ai.forthecult.store).
 * Use for capabilities, for-agents page, and auth instruction links.
 * Set NEXT_PUBLIC_AGENT_APP_URL (e.g. https://ai.forthecult.store) to use a subdomain.
 * Returns empty string when not configured — callers must handle this.
 * Strips any trailing &, ? or fragment so sitemap/canonical URLs are never malformed.
 */
export function getAgentBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_AGENT_APP_URL?.trim();
  if (!raw) return "";
  // Drop trailing query/fragment (e.g. copy-paste "https://ai.forthecult.store&" or "?foo=1")
  const withoutQuery = raw.split(/[?#]/)[0]?.trim() ?? "";
  const trimmed = withoutQuery.replace(/[&/]+$/, "");
  if (!trimmed) return "";
  // Accept both "https://ai.example.com" and bare "ai.example.com"
  let url = trimmed;
  if (!/^https?:\/\//i.test(trimmed))
    url = `https://${trimmed.replace(/^\/+/, "")}`;
  else url = trimmed.replace(/\/+$/, "");
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".localhost");
    if (!isLocal && parsed.protocol === "http:") {
      const port = parsed.port && parsed.port !== "80" ? `:${parsed.port}` : "";
      return `https://${parsed.hostname}${port}`;
    }
    return parsed.origin;
  } catch {
    return url;
  }
}

/** Hostname of the agent app URL (e.g. ai.forthecult.store). Empty if not set. */
export function getAgentHostname(): string {
  const url = getAgentBaseUrl();
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Base URL for client-side code. Reads the public env var or falls back
 * to window.location.origin at runtime.
 */
export function getClientBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (typeof window !== "undefined") return window.location.origin;
  return DEFAULT_SERVER;
}

/**
 * Public site URL for canonical links, metadata, sitemaps, emails.
 * Always returns https for production domains (non-localhost) so sitemap and
 * canonicals use a single preferred version.
 * Strips query/fragment and returns origin only to avoid malformed sitemap URLs.
 */
export function getPublicSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_PUBLIC_SITE;
  const withoutQuery = raw.split(/[?#]/)[0]?.trim() ?? "";
  const trimmed = withoutQuery.replace(/[&/]+$/, "");
  const url = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, "")}`;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".localhost");
    if (!isLocal && parsed.protocol === "http:") {
      const port = parsed.port && parsed.port !== "80" ? `:${parsed.port}` : "";
      return `https://${parsed.hostname}${port}`;
    }
    return parsed.origin;
  } catch {
    return url.replace(/\/+$/, "");
  }
}

/**
 * Base URL for the current request (from Host header).
 * Use when you want links to reflect the origin the user is visiting (e.g. forthecult.store/for-agents → forthecult.store/api).
 */
export function getRequestBaseUrl(host: null | string | undefined): string {
  const h = (host ?? "").trim();
  if (!h) return getPublicSiteUrl();
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  return `${protocol}://${h}`;
}

/**
 * Base URL for server-side fetch (e.g. API routes from RSC).
 * Prefers NEXT_SERVER_APP_URL → VERCEL_URL → NEXT_PUBLIC_APP_URL → localhost.
 */
export function getServerBaseUrl(): string {
  if (process.env.NEXT_SERVER_APP_URL) return process.env.NEXT_SERVER_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.NEXT_PUBLIC_APP_URL || DEFAULT_SERVER;
}

/** True when the request host is the configured AI/agent subdomain. */
export function isAgentSubdomain(host: null | string | undefined): boolean {
  const agentHost = getAgentHostname();
  if (!agentHost) return false;
  const h = (host ?? "").trim().toLowerCase();
  return h === agentHost || h.endsWith(`.${agentHost}`);
}

/**
 * For public API responses (e.g. /api/agent/capabilities, /api/agent/summary).
 * Never expose localhost or 127.0.0.1; return fallback instead.
 */
export function sanitizeBaseUrlForPublicApi(
  base: string,
  fallback: string,
): string {
  const u = (base ?? "").trim().toLowerCase();
  if (!u) return fallback;
  if (u.includes("localhost") || u.includes("127.0.0.1")) return fallback;
  return base!.trim();
}

/**
 * True when we should noindex for agent (on agent subdomain) and agent host is distinct from main site.
 * Prevents accidental mass noindex when agent URL is misconfigured to point at the main store.
 */
export function shouldNoindexForAgent(
  host: null | string | undefined,
): boolean {
  const agentHost = getAgentHostname();
  if (!agentHost) return false;
  try {
    const mainHost = new URL(getPublicSiteUrl()).hostname.toLowerCase();
    if (agentHost.toLowerCase() === mainHost) return false;
  } catch {
    return false;
  }
  return isAgentSubdomain(host);
}
