CREATE TABLE IF NOT EXISTS "ai_chat_conversation" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "title" text,
  "messages" jsonb NOT NULL,
  "character_slug" text,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ai_chat_conversation_user_updated_idx" ON "ai_chat_conversation" ("user_id", "updated_at");
