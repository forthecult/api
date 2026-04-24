/**
 * Admin audit logger.
 *
 * Emits one row per admin-authenticated request into admin_audit_log, and
 * mirrors the event to PostHog for dashboarding + alerting. Both writes are
 * best-effort: a failure here MUST NOT block the user request.
 *
 * SOC 2: CC7.2 (monitoring of security events), CC7.3 (evaluation of events).
 */
import crypto from "node:crypto";

import { PostHog } from "posthog-node";

import { db } from "~/db";
import {
  type AdminAuditEvent,
  adminAuditLogTable,
} from "~/db/schema/admin-audit/tables";
import { redactProperties } from "~/lib/analytics/pii-redact";

type PostHogLike = Pick<PostHog, "capture">;

let posthogClient: null | PostHogLike = null;
function getPosthog(): null | PostHogLike {
  if (posthogClient) return posthogClient;
  const key = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  posthogClient = new PostHog(key, {
    flushAt: 1,
    flushInterval: 0,
    host:
      process.env.POSTHOG_HOST ??
      process.env.NEXT_PUBLIC_POSTHOG_HOST ??
      "https://us.i.posthog.com",
  });
  return posthogClient;
}

const IP_HASH_SECRET = process.env.ADMIN_AUDIT_IP_SALT ?? "";

/**
 * Hash the caller IP so we have a stable identifier across sessions for
 * abuse detection, without storing raw IPs (GDPR + CC6.7 data minimization).
 * Requires ADMIN_AUDIT_IP_SALT to avoid rainbow-table attacks.
 */
function hashIp(ip: null | string): null | string {
  if (!ip || !IP_HASH_SECRET) return null;
  return crypto
    .createHmac("sha256", IP_HASH_SECRET)
    .update(ip)
    .digest("hex")
    .slice(0, 32);
}

export interface AdminAuditRecord {
  authMethod: "api_key" | "session" | "unauthenticated";
  authSource?: "admin" | "ai" | null;
  event: AdminAuditEvent;
  ip?: null | string;
  metadata?: null | Record<string, unknown>;
  method: string;
  path: string;
  status: number;
  userEmail?: null | string;
  userId?: null | string;
}

export async function recordAdminAudit(rec: AdminAuditRecord): Promise<void> {
  const payload = {
    authMethod: rec.authMethod,
    authSource: rec.authSource ?? null,
    event: rec.event,
    ipHash: hashIp(rec.ip ?? null),
    metadata: rec.metadata ?? null,
    method: rec.method.toUpperCase(),
    path: rec.path,
    status: rec.status,
    userEmail: rec.userEmail ?? null,
    userId: rec.userId ?? null,
  } as const;

  try {
    await db.insert(adminAuditLogTable).values(payload);
  } catch (err) {
    console.error("[admin-audit] insert failed", {
      err: err instanceof Error ? err.message : String(err),
      event: rec.event,
    });
  }

  const posthog = getPosthog();
  if (posthog) {
    try {
      posthog.capture({
        distinctId: rec.userId ?? rec.userEmail ?? "admin_anon",
        event: `server_${rec.event}`,
        properties: redactProperties({
          auth_method: rec.authMethod,
          auth_source: rec.authSource ?? null,
          ip_hash: payload.ipHash,
          path: rec.path,
          status: rec.status,
        }),
      });
    } catch (err) {
      console.error("[admin-audit] posthog capture failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
