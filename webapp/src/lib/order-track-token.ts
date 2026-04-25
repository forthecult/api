import { createHmac, timingSafeEqual } from "node:crypto";

import { requireAuthSecret } from "~/lib/require-auth-secret";

/**
 * Order-track tokens let guests view their order without logging in. secret
 * precedence: ORDER_TRACK_SECRET (explicit override) → shared AUTH_SECRET.
 * In production `requireAuthSecret` throws when AUTH_SECRET is missing, so
 * this file can no longer silently fall back to a hardcoded literal (h3).
 */
function orderTrackSecret(): string {
  const explicit = process.env.ORDER_TRACK_SECRET;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  return requireAuthSecret("order-track-token");
}

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Create a short-lived token that allows viewing order details without login.
 * Token encodes orderId + expiry; verified server-side with HMAC.
 */
export function createOrderTrackToken(orderId: string): string {
  const expiry = String(Date.now() + TOKEN_TTL_MS);
  const payload = `${orderId}:${expiry}`;
  const sig = createHmac("sha256", orderTrackSecret()).update(payload).digest();
  return `${base64UrlEncode(Buffer.from(expiry))}.${base64UrlEncode(sig)}`;
}

/**
 * Verify token for the given orderId. Returns true if valid and not expired.
 */
export function verifyOrderTrackToken(orderId: string, token: string): boolean {
  if (!token?.trim()) return false;
  const parts = token.trim().split(".");
  if (parts.length !== 2) return false;
  const [expiryB64, sigB64] = parts;
  const expiryBuf = base64UrlDecode(expiryB64);
  const sigBuf = base64UrlDecode(sigB64);
  if (!expiryBuf || !sigBuf) return false;
  const expiry = parseInt(expiryBuf.toString("utf8"), 10);
  if (Number.isNaN(expiry) || Date.now() > expiry) return false;
  const payload = `${orderId}:${expiry}`;
  const expected = createHmac("sha256", orderTrackSecret())
    .update(payload)
    .digest();
  if (expected.length !== sigBuf.length) return false;
  return timingSafeEqual(expected, sigBuf);
}

function base64UrlDecode(str: string): Buffer | null {
  try {
    return Buffer.from(str, "base64url");
  } catch {
    return null;
  }
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}
