-- Moltbook agent preferences (key-value per agent).
-- Run with: psql $DATABASE_URL -f scripts/migrate-agent-preferences.sql

CREATE TABLE IF NOT EXISTS "agent_preference" (
  "moltbook_agent_id" text NOT NULL,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamp NOT NULL,
  PRIMARY KEY ("moltbook_agent_id", "key")
);

COMMENT ON TABLE "agent_preference" IS 'Key-value preferences per Moltbook agent (e.g. default_shipping_country).';
