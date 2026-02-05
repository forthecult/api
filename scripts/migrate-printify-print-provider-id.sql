-- Migration: Add Printify print provider ID for shipping calculation
-- Run: psql $DATABASE_URL -f scripts/migrate-printify-print-provider-id.sql
-- Or use: bun run db:push (drizzle-kit push) to sync schema

ALTER TABLE product
  ADD COLUMN IF NOT EXISTS printify_print_provider_id INTEGER;

COMMENT ON COLUMN product.printify_print_provider_id IS 'Printify print_provider_id; required for Printify catalog shipping calculation. Re-sync Printify products to backfill.';
