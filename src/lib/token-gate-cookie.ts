import { createHmac, timingSafeEqual } from "node:crypto";

import type { TokenGateResourceType } from "~/lib/token-gate";

import { requireAuthSecret } from "~/lib/require-auth-secret";

function secret(): string {
  return requireAuthSecret("token-gate-cookie");
}

const COOKIE_NAME = "tg";
const MAX_AGE_SEC = 60 * 60; // 1 hour

/**
 * Cookie entry. Entries issued before m3 may be missing `w`; those are
 * treated as stale and are stripped on the next write.
 *
 * Bound wallet: when a user proves gate eligibility via SIWS, the cookie
 * remembers which wallet did so. If the same browser later connects a
 * different wallet, we issue a fresh cookie bound to it instead of stacking
 * — this prevents sharing a passed cookie across users.
 */
interface Entry {
  /** unix millis expiry */
  e: number;
  /** resource id (slug / db id) */
  i: string;
  /** resource type — "product" | "category" | "page" */
  t: string;
  /** wallet address that proved eligibility. */
  w: string;
}

/**
 * Build a Set-Cookie header value that adds (or refreshes) a passed-gate entry for this resource.
 * Entries from wallets other than `wallet` are dropped so the cookie only ever
 * reflects the currently connected wallet's gates.
 */
export function buildTokenGateSetCookie(
  currentCookieValue: string | undefined,
  resourceType: TokenGateResourceType,
  resourceId: string,
  wallet: string,
): string {
  const normWallet = wallet.trim();
  if (!normWallet) {
    throw new Error("buildTokenGateSetCookie requires a wallet address");
  }
  const existing = parseAndVerify(currentCookieValue ?? "") ?? [];
  const type = resourceType.toLowerCase();
  const id = resourceId.trim();
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  // drop entries from other wallets (prevents cross-wallet cookie sharing) and
  // any stale pre-m3 entries (missing `w`). also drop any existing entry for
  // this (type, id) so we refresh expiry.
  const updated = existing
    .filter(
      (e) =>
        typeof e.w === "string" &&
        e.w === normWallet &&
        !(e.t === type && e.i === id),
    )
    .concat([{ e: exp, i: id, t: type, w: normWallet }]);
  const value = signPayload(updated);
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SEC}; ${process.env.NODE_ENV === "production" ? "Secure; " : ""}`.trim();
}

/**
 * Check if the request has a valid token-gate cookie for this resource.
 * When `wallet` is provided the entry must also be bound to that wallet;
 * callers who don't know the current wallet can omit it (weaker guarantee).
 */
export function hasValidTokenGateCookie(
  cookieValue: string | undefined,
  resourceType: TokenGateResourceType,
  resourceId: string,
  wallet?: string,
): boolean {
  const entries = parseAndVerify(cookieValue ?? "");
  if (!entries) return false;
  const type = resourceType.toLowerCase();
  const id = resourceId.trim();
  const normWallet = wallet?.trim();
  return entries.some((e) => {
    if (e.t !== type || e.i !== id) return false;
    if (typeof e.w !== "string" || e.w.length === 0) return false; // m3: stale pre-binding entries never count
    if (normWallet != null && normWallet.length > 0 && e.w !== normWallet)
      return false;
    return true;
  });
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
  const expected = createHmac("sha256", secret()).update(payload).digest();
  if (expected.length !== sigBuf.length) return null;
  if (!timingSafeEqual(expected, sigBuf)) return null;
  const now = Date.now();
  return entries.filter((e) => e.e > now && e.t && e.i);
}

function signPayload(entries: Entry[]): string {
  const payload = JSON.stringify(entries);
  const sig = createHmac("sha256", secret()).update(payload).digest();
  return `${base64UrlEncode(Buffer.from(payload))}.${base64UrlEncode(sig)}`;
}

export { COOKIE_NAME };
