-- Migration: Printify Express/Economy shipping eligibility flags + GPSR compliance + cost columns
-- Run after deploying the schema changes to productsTable and ordersTable.

-- 1. Product shipping eligibility flags (from Printify product data)
ALTER TABLE "product"
  ADD COLUMN IF NOT EXISTS "printify_express_eligible" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "printify_express_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "printify_economy_eligible" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "printify_economy_enabled" boolean NOT NULL DEFAULT false;

-- 2. GPSR compliance data (EU General Product Safety Regulation)
ALTER TABLE "product"
  ADD COLUMN IF NOT EXISTS "gpsr_json" jsonb;

-- 3. Printify fulfillment cost columns for orders (parity with Printful cost tracking)
ALTER TABLE "order"
  ADD COLUMN IF NOT EXISTS "printify_cost_total_cents" integer,
  ADD COLUMN IF NOT EXISTS "printify_cost_shipping_cents" integer,
  ADD COLUMN IF NOT EXISTS "printify_cost_tax_cents" integer;

-- Verify product columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'product'
  AND column_name IN (
    'printify_express_eligible', 'printify_express_enabled',
    'printify_economy_eligible', 'printify_economy_enabled',
    'gpsr_json'
  )
ORDER BY column_name;

-- Verify order columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'order'
  AND column_name LIKE 'printify_cost_%'
ORDER BY column_name;
