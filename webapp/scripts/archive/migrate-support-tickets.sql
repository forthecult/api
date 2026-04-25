-- Migration: Support tickets table
-- Usage: psql $DATABASE_URL -f scripts/migrate-support-tickets.sql
-- Or run: bun run db:push (Drizzle will sync schema)

BEGIN;

CREATE TABLE IF NOT EXISTS "support_ticket" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "subject" text NOT NULL,
  "message" text NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "type" text NOT NULL DEFAULT 'normal',
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

COMMIT;
