-- Migration: Add gender column to product_variant for 3-option products (e.g. Color + Men/Women + Size)
-- Run: psql $DATABASE_URL -f scripts/migrate-product-variant-gender.sql
-- Or use: bun run db:push (Drizzle will sync schema)

ALTER TABLE product_variant
  ADD COLUMN IF NOT EXISTS gender TEXT;

COMMENT ON COLUMN product_variant.gender IS 'Gender/style option (e.g. Men''s / Women''s). Used when product has 3 option dimensions.';
