-- Migration: Add Printful and Printify sync fields for bidirectional product synchronization
-- Run this migration to add the necessary columns to the product and product_variant tables

-- Add Printful/Printify sync fields to products table
ALTER TABLE product 
  ADD COLUMN IF NOT EXISTS printful_sync_product_id INTEGER UNIQUE,
  ADD COLUMN IF NOT EXISTS printify_product_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_printful_sync_product_id ON product (printful_sync_product_id);
CREATE INDEX IF NOT EXISTS idx_product_printify_product_id ON product (printify_product_id);
CREATE INDEX IF NOT EXISTS idx_product_source ON product (source);

-- Add Printful/Printify sync fields to product_variant table
ALTER TABLE product_variant 
  ADD COLUMN IF NOT EXISTS printful_sync_variant_id INTEGER UNIQUE,
  ADD COLUMN IF NOT EXISTS printify_variant_id TEXT UNIQUE;

-- Create indexes for variant lookups
CREATE INDEX IF NOT EXISTS idx_product_variant_printful_sync_variant_id ON product_variant (printful_sync_variant_id);
CREATE INDEX IF NOT EXISTS idx_product_variant_printify_variant_id ON product_variant (printify_variant_id);

-- Comments for documentation
COMMENT ON COLUMN product.printful_sync_product_id IS 'Printful sync_product.id for bidirectional product sync';
COMMENT ON COLUMN product.printify_product_id IS 'Printify product.id for bidirectional product sync';
COMMENT ON COLUMN product.last_synced_at IS 'Timestamp of last sync with Printful/Printify';
COMMENT ON COLUMN product_variant.printful_sync_variant_id IS 'Printful sync_variant.id for variant sync';
COMMENT ON COLUMN product_variant.printify_variant_id IS 'Printify variant.id for variant sync';
