/**
 * Centralized app URL helpers for customer-facing and server code.
 * Use these instead of repeating env checks across pages.
 */

const DEFAULT_SERVER = "http://localhost:3000";
const DEFAULT_PUBLIC_SITE = "https://forthecult.store";

/**
 * Base URL for server-side fetch (e.g. API routes from RSC).
 * Prefers NEXT_SERVER_APP_URL → VERCEL_URL → NEXT_PUBLIC_APP_URL → localhost.
 */
export function getServerBaseUrl(): string {
  if (process.env.NEXT_SERVER_APP_URL) return process.env.NEXT_SERVER_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.NEXT_PUBLIC_APP_URL || DEFAULT_SERVER;
}

/**
 * Public site URL for canonical links, metadata, sitemaps, emails.
 * Must be https when used in production.
 */
export function getPublicSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_PUBLIC_SITE;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, "")}`;
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
 * Base URL for the agent-facing experience (e.g. ai.forthecult.store).
 * Use for capabilities, for-agents page, and auth instruction links.
 * Set NEXT_PUBLIC_AGENT_APP_URL (e.g. https://ai.forthecult.store) to use a subdomain.
 */
export function getAgentBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_AGENT_APP_URL?.trim();
  if (raw && /^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
  return getPublicSiteUrl().replace(/\/$/, "");
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

/** True when the request host is the configured AI/agent subdomain. */
export function isAgentSubdomain(host: string | null | undefined): boolean {
  const agentHost = getAgentHostname();
  if (!agentHost) return false;
  const h = (host ?? "").trim().toLowerCase();
  return h === agentHost || h.endsWith(`.${agentHost}`);
}
