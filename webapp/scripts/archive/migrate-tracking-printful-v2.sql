-- Migration: Add tracking, Printful costs, product type/discontinued, variant colorCode2
-- Run: psql $DATABASE_URL -f scripts/archive/migrate-tracking-printful-v2.sql
-- Or: bun run db:push (drizzle will apply schema changes)
--
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

BEGIN;

-- ============================================================================
-- Orders: shipment tracking columns
-- ============================================================================

ALTER TABLE "order" ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS tracking_carrier TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS estimated_delivery_from TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS estimated_delivery_to TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS tracking_events_json JSONB;

-- ============================================================================
-- Orders: Printful wholesale cost columns (admin-only)
-- ============================================================================

ALTER TABLE "order" ADD COLUMN IF NOT EXISTS printful_cost_total_cents INTEGER;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS printful_cost_shipping_cents INTEGER;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS printful_cost_tax_cents INTEGER;

-- ============================================================================
-- Products: type and discontinued
-- ============================================================================

ALTER TABLE product ADD COLUMN IF NOT EXISTS product_type TEXT;
ALTER TABLE product ADD COLUMN IF NOT EXISTS is_discontinued BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- Product variants: secondary color code
-- ============================================================================

ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS color_code2 TEXT;

COMMIT;
