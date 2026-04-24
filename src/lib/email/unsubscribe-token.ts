import { createHmac, timingSafeEqual } from "node:crypto";

import { getPublicSiteUrl } from "~/lib/app-url";

export type UnsubscribeCategory = "marketing" | "newsletter";

export interface UnsubscribeTokenPayload {
  category: UnsubscribeCategory;
  email: string;
  exp: number;
  v: 1;
}

export function buildUnsubscribeUrl(
  email: string,
  category: UnsubscribeCategory,
  ttlSeconds = 60 * 60 * 24 * 365,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = signUnsubscribePayload({
    category,
    email: email.trim().toLowerCase(),
    exp,
    v: 1,
  });
  const base = getPublicSiteUrl().replace(/\/$/, "");
  return `${base}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function signUnsubscribePayload(
  payload: UnsubscribeTokenPayload,
): string {
  const body = JSON.stringify(payload);
  const bodyB64 = base64UrlEncode(Buffer.from(body, "utf8"));
  const sig = createHmac("sha256", getSecret())
    .update(bodyB64)
    .digest("base64url");
  return `${bodyB64}.${sig}`;
}

export function verifyUnsubscribeToken(
  token: string,
):
  | { error: string; ok: false }
  | { ok: true; payload: UnsubscribeTokenPayload } {
  const parts = token.split(".");
  if (parts.length !== 2) return { error: "invalid_token", ok: false };
  const [bodyB64, sig] = parts;
  if (!bodyB64 || !sig) return { error: "invalid_token", ok: false };
  const expected = createHmac("sha256", getSecret())
    .update(bodyB64)
    .digest("base64url");
  const sigBuf = Buffer.from(sig, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { error: "bad_signature", ok: false };
  }
  let payload: UnsubscribeTokenPayload;
  try {
    payload = JSON.parse(
      base64UrlDecode(bodyB64).toString("utf8"),
    ) as UnsubscribeTokenPayload;
  } catch {
    return { error: "invalid_payload", ok: false };
  }
  if (payload.v !== 1 || typeof payload.email !== "string")
    return { error: "invalid_payload", ok: false };
  if (payload.exp < Date.now() / 1000) return { error: "expired", ok: false };
  if (payload.category !== "marketing" && payload.category !== "newsletter") {
    return { error: "invalid_category", ok: false };
  }
  return { ok: true, payload };
}

function base64UrlDecode(s: string): Buffer {
  const pad = 4 - (s.length % 4);
  const b64 =
    s.replace(/-/g, "+").replace(/_/g, "/") + (pad < 4 ? "=".repeat(pad) : "");
  return Buffer.from(b64, "base64");
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

function getSecret(): string {
  const s = process.env.EMAIL_UNSUBSCRIBE_SECRET?.trim();
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "EMAIL_UNSUBSCRIBE_SECRET must be set (min 16 chars) in production",
      );
    }
    return "dev-only-email-unsubscribe-secret-change-me";
  }
  return s;
}
