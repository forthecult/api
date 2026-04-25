-- Run after pull: adds columns for profile, category storefront options, gift cards.
-- Review in staging before production. Apply with: psql "$DATABASE_URL" -f webapp/scripts/schema-bump-2026-04-user-category-coupon.sql

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS birth_date text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone_country text;

ALTER TABLE "category" ADD COLUMN IF NOT EXISTS footer_reviews_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE "category" ADD COLUMN IF NOT EXISTS footer_reviews_store_wide boolean NOT NULL DEFAULT true;
ALTER TABLE "category" ADD COLUMN IF NOT EXISTS marketing_block_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE "category" ADD COLUMN IF NOT EXISTS marketing_block_html text;

ALTER TABLE "coupon" ADD COLUMN IF NOT EXISTS is_gift_card boolean NOT NULL DEFAULT false;
