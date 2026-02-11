/**
 * HMAC-based confirmation token for order success pages.
 *
 * Generated server-side at order creation, returned to the client, and stored
 * in sessionStorage. The success page sends it back to prove the viewer is the
 * original buyer (browser that completed checkout). This avoids the need for a
 * DB column — the server re-derives the token to verify.
 *
 * Server-only — do not import from client code.
 */

import { createHmac } from "node:crypto";

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production");
  }
  return "dev-secret-min-32-chars-for-better-auth-local";
}

/**
 * Generate a confirmation token for a given identifier (orderId or Stripe sessionId).
 * The token is deterministic — the server can re-derive it to verify without DB storage.
 */
export function generateOrderConfirmationToken(identifier: string): string {
  return createHmac("sha256", getSecret())
    .update(`order-confirm:${identifier}`)
    .digest("hex")
    .slice(0, 32);
}

/** Verify a confirmation token against an identifier. */
export function verifyOrderConfirmationToken(
  identifier: string,
  token: string | null | undefined,
): boolean {
  if (!token || !identifier) return false;
  const expected = generateOrderConfirmationToken(identifier);
  // Timing-safe comparison
  if (token.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return mismatch === 0;
}
