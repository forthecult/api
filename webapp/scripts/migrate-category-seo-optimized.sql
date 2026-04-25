-- Migration: Add seo_optimized to category table (admin "Optimized" checkbox)
-- Run before or after deploying the code that uses seoOptimized.

ALTER TABLE "category" ADD COLUMN IF NOT EXISTS "seo_optimized" BOOLEAN NOT NULL DEFAULT false;
