-- Add source column so admin can see if the customer is on web or mobile app.
-- Run: psql $DATABASE_URL -f scripts/migrate-support-chat-source.sql

ALTER TABLE support_chat_conversation
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web';

COMMENT ON COLUMN support_chat_conversation.source IS 'web = storefront, mobile = native app';
