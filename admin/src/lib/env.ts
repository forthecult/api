declare global {
  interface Window {
    /** @deprecated use meta ftc-storefront-origin; still set when present */
    __MAIN_APP_URL?: string;
  }
}

function normalizeMainAppUrl(raw: string): string {
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

function readStorefrontUrlFromDom(): string {
  if (typeof document === "undefined") return "";
  const meta = document.querySelector('meta[name="ftc-storefront-origin"]');
  const c = meta?.getAttribute("content")?.trim();
  return c ? normalizeMainAppUrl(c) : "";
}

/**
 * Public storefront URL (customer site). Used for links and sign-in redirects.
 * Client prefers meta `ftc-storefront-origin` (set in layout) so runtime env works on Railway.
 */
export function getMainAppUrl(): string {
  if (typeof window !== "undefined") {
    const fromMeta = readStorefrontUrlFromDom();
    if (fromMeta) return fromMeta;
    if (window.__MAIN_APP_URL !== undefined) {
      return normalizeMainAppUrl(window.__MAIN_APP_URL);
    }
  }
  const raw =
    process.env.NEXT_PUBLIC_MAIN_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  return normalizeMainAppUrl(raw ?? "");
}

/**
 * Base for admin `fetch()` calls. Default `""` (same origin) so session cookies stay on the admin host;
 * `admin/next.config.ts` rewrites `/api/*` to the storefront. Set `NEXT_PUBLIC_ADMIN_API_RELATIVE=0` to
 * call the storefront origin directly (legacy cross-origin + shared cookie; requires
 * `AUTH_SHARE_SESSION_COOKIE_WITH_ADMIN=true` on the main app).
 */
export function getAdminApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_ADMIN_API_RELATIVE === "0") {
    return getMainAppUrl();
  }
  const raw =
    process.env.NEXT_PUBLIC_MAIN_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return getMainAppUrl();
  return "";
}

/** Better Auth client base: always the admin origin so session cookies are never scoped to the storefront. */
export function getAuthClientBaseUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  const u = process.env.NEXT_PUBLIC_ADMIN_APP_URL?.trim();
  if (u) return normalizeMainAppUrl(u);
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3001";
  return "";
}
