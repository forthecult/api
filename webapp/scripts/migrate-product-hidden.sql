-- Add hidden flag to product: when true, product is still published but only reachable by direct slug URL; excluded from category and product listings.
-- Run with: psql $DATABASE_URL -f scripts/migrate-product-hidden.sql
-- Or use: pnpm db:push (Drizzle will add the column from schema).

ALTER TABLE "product"
ADD COLUMN IF NOT EXISTS "hidden" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "product"."hidden" IS 'When true, product is still published but only reachable by direct link; not listed in categories or product listings.';
