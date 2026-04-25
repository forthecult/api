-- Add Amazon product fields to existing database
-- Run with: psql $DATABASE_URL -f scripts/migrate-amazon-product-fields.sql

-- Add amazonAsin and amazonPriceRefreshedAt to products table
ALTER TABLE product ADD COLUMN IF NOT EXISTS amazon_asin text;
ALTER TABLE product ADD COLUMN IF NOT EXISTS amazon_price_refreshed_at timestamp;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'product' 
  AND column_name IN ('amazon_asin', 'amazon_price_refreshed_at');
