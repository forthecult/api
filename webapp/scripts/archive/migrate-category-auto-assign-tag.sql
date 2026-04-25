-- Add tag_contains to category_auto_assign_rule for filtering by product tags.
-- Run with: psql $DATABASE_URL -f scripts/migrate-category-auto-assign-tag.sql
-- Or use: pnpm db:push (Drizzle will add the column from schema).

ALTER TABLE "category_auto_assign_rule"
ADD COLUMN IF NOT EXISTS "tag_contains" text;

COMMENT ON COLUMN "category_auto_assign_rule"."tag_contains" IS 'Product must have at least one tag containing this (ilike).';
