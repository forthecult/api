/**
 * admin_audit_log — append-only record of every admin-authenticated request.
 *
 * SOC 2 mapping: CC7.2 (monitoring of security events) and CC7.3 (response to
 * security events). Paired with PostHog mirroring for dashboard + alerting.
 *
 * Rules:
 *   - Writes MUST be best-effort (never block the user request on an audit
 *     write failure — fail open and surface a metric).
 *   - Rows MUST be immutable. There are no UPDATE/DELETE code paths in
 *     application code; retention is handled at the DB level via a scheduled
 *     job (see docs/DATA-RETENTION.md → TODO).
 *   - PII minimization: store IP, user id, email, route, method, status, and
 *     an opaque `metadata` jsonb for route-specific context. Never store
 *     request bodies or response bodies here.
 */
import { createId } from "@paralleldrive/cuid2";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export type AdminAuditEvent =
  | "admin.auth.failure"
  | "admin.auth.success"
  | "admin.bootstrap_email_used"
  | "admin.passkey_missing_denied";

export const adminAuditLogTable = pgTable(
  "admin_audit_log",
  {
    // "api_key" | "session" | "unauthenticated"
    authMethod: text("auth_method").notNull(),
    // "admin" | "ai" | null — distinguishes rotated vs human keys
    authSource: text("auth_source"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    event: text("event").$type<AdminAuditEvent>().notNull(),
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    ipHash: text("ip_hash"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    method: text("method").notNull(),
    path: text("path").notNull(),
    status: integer("status").notNull(),
    userEmail: text("user_email"),
    userId: text("user_id"),
  },
  (t) => [
    index("admin_audit_log_created_at_idx").on(t.createdAt),
    index("admin_audit_log_event_idx").on(t.event),
    index("admin_audit_log_user_id_idx").on(t.userId),
  ],
);
