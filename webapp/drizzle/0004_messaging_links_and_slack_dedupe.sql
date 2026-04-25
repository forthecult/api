-- Per-external-user link to FTC account (Slack/Discord under a shared bot connection).
CREATE TABLE IF NOT EXISTS "ai_messaging_user_link" (
  "id" text PRIMARY KEY NOT NULL,
  "messaging_channel_id" text NOT NULL REFERENCES "ai_messaging_channel"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "external_user_id" text NOT NULL,
  "external_team_id" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE ("messaging_channel_id", "provider", "external_user_id")
);

CREATE INDEX IF NOT EXISTS "ai_messaging_user_link_lookup_idx"
  ON "ai_messaging_user_link" ("messaging_channel_id", "provider", "external_user_id");

CREATE INDEX IF NOT EXISTS "ai_messaging_user_link_user_idx"
  ON "ai_messaging_user_link" ("user_id");

-- Slack Events API retries: dedupe by event_id.
CREATE TABLE IF NOT EXISTS "slack_event_processed" (
  "event_id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "slack_event_processed_created_idx"
  ON "slack_event_processed" ("created_at");

ALTER TABLE "ai_messaging_channel"
  ADD COLUMN IF NOT EXISTS "discord_link_code" text;

ALTER TABLE "ai_messaging_channel"
  ADD COLUMN IF NOT EXISTS "slack_link_code" text;

CREATE UNIQUE INDEX IF NOT EXISTS "ai_messaging_channel_discord_link_code_uidx"
  ON "ai_messaging_channel" ("discord_link_code")
  WHERE "discord_link_code" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ai_messaging_channel_slack_link_code_uidx"
  ON "ai_messaging_channel" ("slack_link_code")
  WHERE "slack_link_code" IS NOT NULL;
