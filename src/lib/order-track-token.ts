import { createHmac, timingSafeEqual } from "node:crypto";

const ORDER_TRACK_SECRET =
  process.env.ORDER_TRACK_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  "order-track-fallback";
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Create a short-lived token that allows viewing order details without login.
 * Token encodes orderId + expiry; verified server-side with HMAC.
 */
export function createOrderTrackToken(orderId: string): string {
  const expiry = String(Date.now() + TOKEN_TTL_MS);
  const payload = `${orderId}:${expiry}`;
  const sig = createHmac("sha256", ORDER_TRACK_SECRET).update(payload).digest();
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
  if (isNaN(expiry) || Date.now() > expiry) return false;
  const payload = `${orderId}:${expiry}`;
  const expected = createHmac("sha256", ORDER_TRACK_SECRET)
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
