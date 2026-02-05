-- Migration: Affiliate program tables and order columns
-- Run this BEFORE `bun run db:push` if you have existing data.
-- Usage: psql $DATABASE_URL -f scripts/migrate-affiliate-program.sql

BEGIN;

-- =============================================================================
-- 1. AFFILIATE table
-- =============================================================================
CREATE TABLE IF NOT EXISTS "affiliate" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "code" text NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'pending',
  "commission_type" text NOT NULL DEFAULT 'percent',
  "commission_value" integer NOT NULL DEFAULT 10,
  "customer_discount_type" text,
  "customer_discount_value" integer,
  "application_note" text,
  "admin_note" text,
  "payout_method" text,
  "payout_address" text,
  "total_earned_cents" integer NOT NULL DEFAULT 0,
  "total_paid_cents" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- =============================================================================
-- 2. AFFILIATE_ATTRIBUTION table
-- =============================================================================
CREATE TABLE IF NOT EXISTS "affiliate_attribution" (
  "id" text PRIMARY KEY NOT NULL,
  "affiliate_id" text NOT NULL REFERENCES "affiliate"("id") ON DELETE CASCADE,
  "visitor_id" text NOT NULL,
  "landing_page" text,
  "referrer" text,
  "ip_address" text,
  "created_at" timestamp NOT NULL,
  "converted_at" timestamp,
  "order_id" text
);

-- =============================================================================
-- 3. ORDER table: add affiliate columns
-- =============================================================================
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "affiliate_id" text REFERENCES "affiliate"("id") ON DELETE SET NULL;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "affiliate_code" text;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "affiliate_commission_cents" integer;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "affiliate_discount_cents" integer;

COMMIT;
