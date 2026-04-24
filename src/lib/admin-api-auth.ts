import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

import { db } from "~/db";
import { passkeyTable } from "~/db/schema/passkey-auth/tables";
import { recordAdminAudit } from "~/lib/admin-audit";
import { auth, isAdminUser } from "~/lib/auth";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY?.trim() ?? "";
const ADMIN_AI_API_KEY = process.env.ADMIN_AI_API_KEY?.trim() ?? "";

const REQUIRE_ADMIN_PASSKEY =
  (process.env.REQUIRE_ADMIN_PASSKEY ?? "").trim().toLowerCase() === "1" ||
  (process.env.REQUIRE_ADMIN_PASSKEY ?? "").trim().toLowerCase() === "true";

const ALLOW_ADMIN_EMAIL_BOOTSTRAP =
  (process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP ?? "").trim().toLowerCase() ===
    "1" ||
  (process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP ?? "").trim().toLowerCase() ===
    "true";

type AdminAuthResult =
  | { method: "api_key"; ok: true; source?: "admin" | "ai" }
  | {
      method: "session";
      ok: true;
      user: { email?: string; id: string; role?: null | string };
    }
  | { ok: false; response: Response }
  | { ok: false };

/**
 * When getAdminAuth returns !ok, return this so the route can send 401 or 429.
 */
export function adminAuthFailureResponse(
  result: AdminAuthResult,
): NextResponse | Response {
  if (result.ok)
    throw new Error("adminAuthFailureResponse only when !result.ok");
  return "response" in result && result.response
    ? result.response
    : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Resolve admin authentication from either:
 *   1. API key: Authorization: Bearer <key> or X-API-Key: <key>
 *   2. Session: Better Auth cookie for a user with role="admin" (or, if the
 *      env-var bootstrap is explicitly enabled, an email in ADMIN_EMAILS).
 *
 * Additionally:
 *   - Rate-limits by IP (200/min).
 *   - When REQUIRE_ADMIN_PASSKEY=1, session-based admin access requires the
 *     user to have at least one registered passkey (defense-in-depth 2FA).
 *   - Emits an admin_audit_log row for every success AND every denial, so
 *     SOC 2 CC7.2 has a monitoring trail.
 */
export async function getAdminAuth(
  request: NextRequest,
): Promise<AdminAuthResult> {
  const ip = getClientIp(request.headers);
  const path = new URL(request.url).pathname;
  const method = request.method;

  const rlResult = await checkRateLimit(`admin:${ip}`, RATE_LIMITS.admin);
  if (!rlResult.success) {
    return { ok: false, response: rateLimitResponse(rlResult) };
  }

  const authHeader = request.headers.get("authorization");
  const apiKeyHeader = request.headers.get("x-api-key");

  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const key = bearer ?? apiKeyHeader?.trim() ?? null;

  if (key) {
    if (ADMIN_AI_API_KEY && constantTimeEqual(ADMIN_AI_API_KEY, key)) {
      void recordAdminAudit({
        authMethod: "api_key",
        authSource: "ai",
        event: "admin.auth.success",
        ip,
        method,
        path,
        status: 200,
      });
      return { method: "api_key", ok: true, source: "ai" };
    }
    if (ADMIN_API_KEY && constantTimeEqual(ADMIN_API_KEY, key)) {
      void recordAdminAudit({
        authMethod: "api_key",
        authSource: "admin",
        event: "admin.auth.success",
        ip,
        method,
        path,
        status: 200,
      });
      return { method: "api_key", ok: true, source: "admin" };
    }
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user && isAdminUser(session.user)) {
    const user = session.user as {
      email?: string;
      id: string;
      role?: null | string;
    };
    const bootstrappedByEmail =
      user.role !== "admin" &&
      typeof user.email === "string" &&
      user.email.length > 0;

    if (bootstrappedByEmail && !ALLOW_ADMIN_EMAIL_BOOTSTRAP) {
      void recordAdminAudit({
        authMethod: "session",
        event: "admin.auth.failure",
        ip,
        metadata: { reason: "email_bootstrap_disabled" },
        method,
        path,
        status: 401,
        userEmail: user.email,
        userId: user.id,
      });
      return { ok: false };
    }
    if (bootstrappedByEmail && ALLOW_ADMIN_EMAIL_BOOTSTRAP) {
      void recordAdminAudit({
        authMethod: "session",
        event: "admin.bootstrap_email_used",
        ip,
        metadata: { reason: "fell_back_to_admin_emails" },
        method,
        path,
        status: 200,
        userEmail: user.email,
        userId: user.id,
      });
    }

    if (REQUIRE_ADMIN_PASSKEY) {
      const hasPasskey = await userHasPasskey(user.id);
      if (!hasPasskey) {
        void recordAdminAudit({
          authMethod: "session",
          event: "admin.passkey_missing_denied",
          ip,
          method,
          path,
          status: 401,
          userEmail: user.email,
          userId: user.id,
        });
        return {
          ok: false,
          response: NextResponse.json(
            {
              error: "admin_passkey_required",
              message:
                "Register a passkey on /account/security before using admin routes.",
            },
            { status: 401 },
          ),
        };
      }
    }

    void recordAdminAudit({
      authMethod: "session",
      event: "admin.auth.success",
      ip,
      method,
      path,
      status: 200,
      userEmail: user.email,
      userId: user.id,
    });
    return { method: "session", ok: true, user };
  }

  void recordAdminAudit({
    authMethod: "unauthenticated",
    event: "admin.auth.failure",
    ip,
    method,
    path,
    status: 401,
  });
  return { ok: false };
}

async function userHasPasskey(userId: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ id: passkeyTable.id })
      .from(passkeyTable)
      .where(eq(passkeyTable.userId, userId))
      .limit(1);
    return rows.length > 0;
  } catch (err) {
    console.error("[admin-auth] passkey lookup failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** Timing-safe comparison to prevent key extraction via timing attacks. */
function constantTimeEqual(a: string, b: string): boolean {
  const sA = typeof a === "string" ? a : String(a);
  const sB = typeof b === "string" ? b : String(b);
  if (sA.length !== sB.length) return false;
  const bufA = Buffer.from(sA, "utf8");
  const bufB = Buffer.from(sB, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
