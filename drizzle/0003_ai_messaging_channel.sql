CREATE TABLE IF NOT EXISTS "ai_messaging_channel" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "telegram_bot_token" text,
  "telegram_webhook_secret" text,
  "telegram_chat_id" text,
  "telegram_link_code" text,
  "discord_bot_token" text,
  "discord_public_key" text,
  "discord_application_id" text,
  "slack_bot_token" text,
  "slack_signing_secret" text,
  "slack_app_id" text,
  "slack_team_id" text,
  "linked_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_messaging_channel_user_provider_uidx"
  ON "ai_messaging_channel" ("user_id", "provider");

CREATE INDEX IF NOT EXISTS "ai_messaging_channel_user_idx"
  ON "ai_messaging_channel" ("user_id");
