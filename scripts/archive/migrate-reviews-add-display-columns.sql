-- Migration: Add display columns to product_review for admin and storefront.
-- Run this if the admin Product Reviews page returns 500 (e.g. "column does not exist").
-- Usage: psql $DATABASE_URL -f scripts/migrate-reviews-add-display-columns.sql

-- Add columns used by admin reviews API and review display (idempotent)
ALTER TABLE product_review
  ADD COLUMN IF NOT EXISTS product_slug TEXT,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS author TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT;

-- Ensure updated_at exists (some older schemas may not have it)
ALTER TABLE product_review
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
