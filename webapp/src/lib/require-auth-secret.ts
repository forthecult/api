/**
 * Centralised access to `AUTH_SECRET`. throws loudly in production when the
 * env var is missing, and returns a dev-only fallback otherwise so local
 * development still boots without one.
 *
 * fixing h3: previously each caller (`token-gate-cookie`, `reviews`) had its
 * own hardcoded fallback literal, so in a prod environment where the var was
 * accidentally unset, hmac-signed cookies became trivially forgeable.
 */

const PRODUCTION_ERROR =
  "AUTH_SECRET environment variable is required in production (used for hmac signing).";

/**
 * @param devFallback identifier the caller uses for its dev-only namespace,
 *   so the fallback is still bound to a specific use (cookies vs. review names)
 *   in case the same process calls both.
 */
export function requireAuthSecret(devFallback: string): string {
  const value = process.env.AUTH_SECRET;
  if (typeof value === "string" && value.length > 0) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(PRODUCTION_ERROR);
  }
  return `dev-only-auth-secret-fallback::${devFallback}`;
}
