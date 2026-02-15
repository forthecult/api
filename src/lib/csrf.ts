/**
 * CSRF protection via Origin header verification.
 *
 * Since the app uses sameSite: "none" for cross-origin admin app support,
 * browser-level CSRF protection is disabled. This module verifies that
 * state-changing requests originate from trusted origins.
 *
 * Apply `verifyCsrfOrigin()` to all POST/PATCH/DELETE API handlers.
 */

/**
 * Build the set of trusted origins from environment variables.
 * Cached after first call.
 */
let _trustedOrigins: null | Set<string> = null;

/**
 * Helper to return a 403 response for CSRF failures.
 */
export function csrfFailureResponse() {
  return new Response(JSON.stringify({ error: "Forbidden: invalid origin" }), {
    headers: { "Content-Type": "application/json" },
    status: 403,
  });
}

/**
 * Verify that a request's Origin (or Referer) header matches a trusted origin.
 *
 * @returns `true` if the origin is trusted or absent (same-origin requests
 *          sometimes omit the Origin header), `false` if it's from an untrusted origin.
 */
export function verifyCsrfOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  const referer = headers.get("referer");

  // Same-origin requests may omit the Origin header entirely — allow them
  if (!origin && !referer) return true;

  const trusted = getTrustedOrigins();

  // Check Origin header first (most reliable)
  if (origin) {
    return trusted.has(origin);
  }

  // Fall back to Referer header
  if (referer) {
    try {
      const parsed = new URL(referer);
      return trusted.has(parsed.origin);
    } catch {
      return false;
    }
  }

  return false;
}

function getTrustedOrigins(): Set<string> {
  if (_trustedOrigins) return _trustedOrigins;

  const origins = new Set<string>();

  if (process.env.NODE_ENV === "development") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
    origins.add("http://localhost:3001");
    origins.add("http://127.0.0.1:3001");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_APP_URL;
  const serverUrl = process.env.NEXT_SERVER_APP_URL;

  for (const raw of [appUrl, adminUrl, serverUrl]) {
    if (!raw) continue;
    try {
      const url = raw.startsWith("http") ? raw : `https://${raw}`;
      const parsed = new URL(url);
      origins.add(parsed.origin);
    } catch {
      // skip invalid URLs
    }
  }

  if (typeof process.env.VERCEL_URL === "string" && process.env.VERCEL_URL) {
    origins.add(`https://${process.env.VERCEL_URL}`);
  }

  _trustedOrigins = origins;
  return origins;
}
