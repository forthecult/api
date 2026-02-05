-- Migration: Add notification preferences columns to user table
-- Run this BEFORE `bun run db:push` if you have existing data.
-- Usage: psql $DATABASE_URL -f scripts/migrate-notification-preferences.sql

BEGIN;

-- =============================================================================
-- USER table: Add notification preference columns for all channels
-- =============================================================================

-- Transactional notification preferences (per channel)
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "transactional_email" boolean NOT NULL DEFAULT true;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "transactional_website" boolean NOT NULL DEFAULT true;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "transactional_sms" boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "transactional_telegram" boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "transactional_ai_companion" boolean NOT NULL DEFAULT false;

-- Marketing notification preferences (per channel)
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "marketing_email" boolean NOT NULL DEFAULT true;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "marketing_website" boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "marketing_sms" boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "marketing_telegram" boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "marketing_ai_companion" boolean NOT NULL DEFAULT false;

-- =============================================================================
-- Backfill: Migrate existing preferences to new columns
-- =============================================================================

-- If user had receive_marketing = true, enable marketing_email
UPDATE "user" SET "marketing_email" = true WHERE "receive_marketing" = true;

-- If user had receive_sms_marketing = true, enable marketing_sms
UPDATE "user" SET "marketing_sms" = true WHERE "receive_sms_marketing" = true;

-- If user had receive_order_notifications_via_telegram = true, enable transactional_telegram
UPDATE "user" SET "transactional_telegram" = true WHERE "receive_order_notifications_via_telegram" = true;

COMMIT;
