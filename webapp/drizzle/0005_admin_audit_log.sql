-- Admin audit log — append-only record of every admin-authenticated request.
-- SOC 2: CC7.2 (monitoring of security events), CC7.3 (evaluation).

CREATE TABLE IF NOT EXISTS "admin_audit_log" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "event" text NOT NULL,
  "auth_method" text NOT NULL,
  "auth_source" text,
  "path" text NOT NULL,
  "method" text NOT NULL,
  "status" integer NOT NULL,
  "user_id" text,
  "user_email" text,
  "ip_hash" text,
  "metadata" jsonb
);

CREATE INDEX IF NOT EXISTS "admin_audit_log_created_at_idx"
  ON "admin_audit_log" ("created_at" DESC);

CREATE INDEX IF NOT EXISTS "admin_audit_log_event_idx"
  ON "admin_audit_log" ("event");

CREATE INDEX IF NOT EXISTS "admin_audit_log_user_id_idx"
  ON "admin_audit_log" ("user_id");

-- Immutability: block UPDATE/DELETE at the database level so even an attacker
-- with write access can't tamper with the audit trail. The table is intended
-- to be append-only; retention is handled by a scheduled job that truncates
-- rows older than 24 months (see docs/DATA-RETENTION.md → TODO).
CREATE OR REPLACE FUNCTION admin_audit_log_block_mutations()
  RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only; % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_audit_log_no_update ON "admin_audit_log";
CREATE TRIGGER admin_audit_log_no_update
  BEFORE UPDATE ON "admin_audit_log"
  FOR EACH ROW EXECUTE FUNCTION admin_audit_log_block_mutations();

DROP TRIGGER IF EXISTS admin_audit_log_no_delete ON "admin_audit_log";
CREATE TRIGGER admin_audit_log_no_delete
  BEFORE DELETE ON "admin_audit_log"
  FOR EACH ROW EXECUTE FUNCTION admin_audit_log_block_mutations();
