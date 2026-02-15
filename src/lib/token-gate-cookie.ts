import { createHmac, timingSafeEqual } from "node:crypto";

import type { TokenGateResourceType } from "~/lib/token-gate";

const SECRET =
  typeof process.env.AUTH_SECRET === "string" &&
  process.env.AUTH_SECRET.length > 0
    ? process.env.AUTH_SECRET
    : "token-gate-cookie-fallback-dev";

const COOKIE_NAME = "tg";
const MAX_AGE_SEC = 60 * 60; // 1 hour

type Entry = { t: string; i: string; e: number };

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function base64UrlDecode(str: string): Buffer | null {
  try {
    return Buffer.from(str, "base64url");
  } catch {
    return null;
  }
}

function signPayload(entries: Entry[]): string {
  const payload = JSON.stringify(entries);
  const sig = createHmac("sha256", SECRET).update(payload).digest();
  return `${base64UrlEncode(Buffer.from(payload))}.${base64UrlEncode(sig)}`;
}

function parseAndVerify(cookieValue: string): Entry[] | null {
  if (!cookieValue?.trim()) return null;
  const parts = cookieValue.trim().split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const payloadBuf = base64UrlDecode(payloadB64);
  const sigBuf = base64UrlDecode(sigB64);
  if (!payloadBuf || !sigBuf) return null;
  let entries: Entry[];
  try {
    const parsed: unknown = JSON.parse(payloadBuf.toString("utf8"));
    if (!Array.isArray(parsed)) return null;
    entries = parsed as Entry[];
  } catch {
    return null;
  }
  const payload = JSON.stringify(entries);
  const expected = createHmac("sha256", SECRET).update(payload).digest();
  if (expected.length !== sigBuf.length) return null;
  if (!timingSafeEqual(expected, sigBuf)) return null;
  const now = Date.now();
  return entries.filter((e) => e.e > now && e.t && e.i);
}

/**
 * Check if the request has a valid token-gate cookie for this resource.
 * Call from server components / route handlers; pass the cookie header or the result of cookies().get(COOKIE_NAME)?.value.
 */
export function hasValidTokenGateCookie(
  cookieValue: string | undefined,
  resourceType: TokenGateResourceType,
  resourceId: string,
): boolean {
  const entries = parseAndVerify(cookieValue ?? "");
  if (!entries) return false;
  const type = resourceType.toLowerCase();
  const id = resourceId.trim();
  return entries.some((e) => e.t === type && e.i === id);
}

/**
 * Build a Set-Cookie header value that adds (or refreshes) a passed-gate entry for this resource.
 * Merge with any existing valid entries so we don't drop other gates.
 */
export function buildTokenGateSetCookie(
  currentCookieValue: string | undefined,
  resourceType: TokenGateResourceType,
  resourceId: string,
): string {
  const existing = parseAndVerify(currentCookieValue ?? "") ?? [];
  const type = resourceType.toLowerCase();
  const id = resourceId.trim();
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  const updated = existing.filter((e) => !(e.t === type && e.i === id));
  updated.push({ t: type, i: id, e: exp });
  const value = signPayload(updated);
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SEC}; ${process.env.NODE_ENV === "production" ? "Secure; " : ""}`.trim();
}

export { COOKIE_NAME };
