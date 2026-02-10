import crypto from "node:crypto";
import type { NextRequest } from "next/server";

import { auth, isAdminUser } from "~/lib/auth";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY?.trim() ?? "";
const ADMIN_AI_API_KEY = process.env.ADMIN_AI_API_KEY?.trim() ?? "";

/** Timing-safe comparison to prevent key extraction via timing attacks. */
function constantTimeEqual(a: string, b: string): boolean {
  // Coerce to string so Buffer.from never receives a Date or other non-string (avoids Node error)
  const sA = typeof a === "string" ? a : String(a);
  const sB = typeof b === "string" ? b : String(b);
  if (sA.length !== sB.length) return false;
  const bufA = Buffer.from(sA, "utf8");
  const bufB = Buffer.from(sB, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Resolve admin authentication from either:
 * 1. API key: Authorization: Bearer <key> or X-API-Key: <key> (must match ADMIN_API_KEY or ADMIN_AI_API_KEY)
 * 2. Session: cookie-based session for a user whose email is in ADMIN_EMAILS
 *
 * Use ADMIN_AI_API_KEY for temporary AI/agent access so you can rotate or revoke it
 * without affecting human admin or scripts using ADMIN_API_KEY. See
 * forthecult-api/guides/ai-admin-temporary-access.md.
 */
export async function getAdminAuth(request: NextRequest): Promise<
  | { ok: true; method: "api_key"; source?: "ai" }
  | { ok: true; method: "session"; user: { id: string; email?: string } }
  | { ok: false }
> {
  const authHeader = request.headers.get("authorization");
  const apiKeyHeader = request.headers.get("x-api-key");

  const bearer =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const key = bearer ?? apiKeyHeader?.trim() ?? null;

  if (key) {
    if (ADMIN_AI_API_KEY && constantTimeEqual(ADMIN_AI_API_KEY, key)) {
      return { ok: true, method: "api_key", source: "ai" };
    }
    if (ADMIN_API_KEY && constantTimeEqual(ADMIN_API_KEY, key)) {
      return { ok: true, method: "api_key" };
    }
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user && isAdminUser(session.user)) {
    return { ok: true, method: "session", user: session.user };
  }

  return { ok: false };
}

/**
 * Use in admin API route handlers:
 * const authResult = await getAdminAuth(request);
 * if (!authResult?.ok) {
 *   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 * }
 */
