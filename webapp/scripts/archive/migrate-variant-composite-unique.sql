-- Migration: Change variant external ID constraints from single-column UNIQUE to composite UNIQUE
-- 
-- Problem: The previous schema had UNIQUE constraints on printful_sync_variant_id and printify_variant_id
-- individually. This is incorrect because:
-- 1. External variant IDs are unique within a product, not globally across all products
-- 2. Different products can share the same blueprint/catalog variant IDs from the provider
-- 3. This applies universally: Printify, Printful, and manual products with variants
--
-- Solution: Change to composite unique constraints on (product_id, external_variant_id)
--
-- Run this migration: psql $DATABASE_URL -f scripts/migrate-variant-composite-unique.sql

-- Step 1: Drop the old single-column unique constraints
-- Note: The constraint names may vary based on how they were created. We try common patterns.

-- Drop Printful variant unique constraint (if exists)
DO $$ 
BEGIN
  -- Try dropping by explicit name from drizzle
  ALTER TABLE product_variant DROP CONSTRAINT IF EXISTS product_variant_printful_sync_variant_id_unique;
EXCEPTION WHEN undefined_object THEN 
  NULL;
END $$;

DO $$ 
BEGIN
  -- Try dropping by PostgreSQL auto-generated name
  ALTER TABLE product_variant DROP CONSTRAINT IF EXISTS product_variant_printful_sync_variant_id_key;
EXCEPTION WHEN undefined_object THEN 
  NULL;
END $$;

-- Drop Printify variant unique constraint (if exists)
DO $$ 
BEGIN
  ALTER TABLE product_variant DROP CONSTRAINT IF EXISTS product_variant_printify_variant_id_unique;
EXCEPTION WHEN undefined_object THEN 
  NULL;
END $$;

DO $$ 
BEGIN
  ALTER TABLE product_variant DROP CONSTRAINT IF EXISTS product_variant_printify_variant_id_key;
EXCEPTION WHEN undefined_object THEN 
  NULL;
END $$;

-- Step 2: Create composite unique constraints
-- These allow the same external variant ID to exist across different products,
-- but ensure uniqueness within a single product

-- Composite unique for Printful variants (product_id + printful_sync_variant_id)
CREATE UNIQUE INDEX IF NOT EXISTS product_variant_printful_unique 
  ON product_variant (product_id, printful_sync_variant_id) 
  WHERE printful_sync_variant_id IS NOT NULL;

-- Composite unique for Printify variants (product_id + printify_variant_id)
CREATE UNIQUE INDEX IF NOT EXISTS product_variant_printify_unique 
  ON product_variant (product_id, printify_variant_id) 
  WHERE printify_variant_id IS NOT NULL;

-- Step 3: Add index for faster variant lookups by product (if not exists)
CREATE INDEX IF NOT EXISTS product_variant_product_id_idx ON product_variant (product_id);

-- Verify the changes
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'product_variant' 
  AND (indexname LIKE '%printful%' OR indexname LIKE '%printify%' OR indexname LIKE '%product_id%');

-- Done! The schema now correctly handles variants:
-- - Same external variant ID can exist in different products
-- - Within a product, each external variant ID is unique
-- - This works for Printify, Printful, and manual products alike
