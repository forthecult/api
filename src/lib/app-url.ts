/**
 * Centralized app URL helpers for customer-facing and server code.
 * Use these instead of repeating env checks across pages.
 */

const DEFAULT_SERVER = "http://localhost:3000";
const DEFAULT_PUBLIC_SITE = "https://forthecult.store";

/**
 * Base URL for server-side fetch (e.g. API routes from RSC).
 * Prefers NEXT_SERVER_APP_URL then NEXT_PUBLIC_APP_URL.
 */
export function getServerBaseUrl(): string {
  return (
    process.env.NEXT_SERVER_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    DEFAULT_SERVER
  );
}

/**
 * Public site URL for canonical links, metadata, sitemaps.
 * Must be https when used in production.
 */
export function getPublicSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_PUBLIC_SITE;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, "")}`;
}
