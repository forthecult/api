-- Migration: Printful schema + crypto + user wallets
-- Run this BEFORE `bun run db:push` if you have existing data.
-- Usage: psql $DATABASE_URL -f scripts/migrate-printful-schema.sql

BEGIN;

-- =============================================================================
-- 1. ADDRESS table: rename columns to Printful-compatible names
-- =============================================================================
ALTER TABLE "address" RENAME COLUMN "line1" TO "address1";
ALTER TABLE "address" RENAME COLUMN "line2" TO "address2";
ALTER TABLE "address" RENAME COLUMN "postal_code" TO "zip";
ALTER TABLE "address" RENAME COLUMN "state" TO "state_code";
ALTER TABLE "address" RENAME COLUMN "country" TO "country_code";
ALTER TABLE "address" ADD COLUMN IF NOT EXISTS "phone" text;

-- =============================================================================
-- 2. ORDER table: rename shipping columns, add new columns
-- =============================================================================
ALTER TABLE "order" RENAME COLUMN "shipping_line1" TO "shipping_address1";
ALTER TABLE "order" RENAME COLUMN "shipping_line2" TO "shipping_address2";
ALTER TABLE "order" RENAME COLUMN "shipping_state" TO "shipping_state_code";
ALTER TABLE "order" RENAME COLUMN "shipping_country" TO "shipping_country_code";
ALTER TABLE "order" RENAME COLUMN "shipping_postal_code" TO "shipping_zip";

ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "shipping_phone" text;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "shipping_option_id" text REFERENCES "shipping_option"("id");
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "shipping_method" text;

ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "payment_method" text NOT NULL DEFAULT 'stripe';
-- Backfill Solana Pay orders
UPDATE "order" SET "payment_method" = 'solana_pay' WHERE "solana_pay_deposit_address" IS NOT NULL;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "crypto_currency_network" text;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "crypto_currency" text;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "crypto_amount" text;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "crypto_tx_hash" text;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "payer_wallet_address" text;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "chain_id" integer;

-- =============================================================================
-- 3. USER_WALLET table: create for Web3 auth
-- =============================================================================
CREATE TABLE IF NOT EXISTS "user_wallet" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "chain" text NOT NULL,
  "address" text NOT NULL,
  "chain_id" integer,
  "label" text,
  "is_primary" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  CONSTRAINT "user_wallet_chain_address" UNIQUE ("chain", "address")
);

COMMIT;
