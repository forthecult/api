-- Add Moltbook agent id to order for agent-only "my orders" and attribution.
-- Run with: psql $DATABASE_URL -f scripts/migrate-moltbook-agent-order.sql
-- Or use: pnpm db:push (Drizzle will add the column from schema).

ALTER TABLE "order"
ADD COLUMN IF NOT EXISTS "moltbook_agent_id" text;

COMMENT ON COLUMN "order"."moltbook_agent_id" IS 'Moltbook agent UUID when order was placed with valid X-Moltbook-Identity.';

CREATE INDEX IF NOT EXISTS "order_moltbook_agent_id_idx" ON "order" ("moltbook_agent_id");
