-- Add features_json to product for bullet-point features (JSON array of strings).
-- Run with: psql $DATABASE_URL -f scripts/migrate-product-features.sql
-- Or use: pnpm db:push (Drizzle will add the column from schema).

ALTER TABLE "product"
ADD COLUMN IF NOT EXISTS "features_json" text;

COMMENT ON COLUMN "product"."features_json" IS 'Bullet-point features (JSON array of strings). Shown on product page; details go in description.';
