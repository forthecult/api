-- Migration: Allow reviews to exist independently of products
-- This enables:
--   - Importing legacy reviews before products exist
--   - Keeping reviews visible after products are archived/deleted
--   - Displaying reviews on homepage/testimonials without active products

-- 1. Add new columns for standalone review support
ALTER TABLE product_review
  ADD COLUMN IF NOT EXISTS product_slug TEXT,
  ADD COLUMN IF NOT EXISTS product_name TEXT;

-- 2. Make product_id nullable (if not already)
ALTER TABLE product_review
  ALTER COLUMN product_id DROP NOT NULL;

-- 3. Change foreign key to SET NULL on delete (instead of CASCADE)
-- First drop the existing constraint, then add new one
ALTER TABLE product_review
  DROP CONSTRAINT IF EXISTS product_review_product_id_fkey;

ALTER TABLE product_review
  ADD CONSTRAINT product_review_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE SET NULL;

-- 4. Backfill product_slug and product_name from existing linked products
UPDATE product_review pr
SET
  product_slug = p.slug,
  product_name = p.name
FROM product p
WHERE pr.product_id = p.id
  AND pr.product_slug IS NULL;

-- 5. Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS product_review_product_id_idx ON product_review(product_id);
CREATE INDEX IF NOT EXISTS product_review_product_slug_idx ON product_review(product_slug);
CREATE INDEX IF NOT EXISTS product_review_visible_created_idx ON product_review(visible, created_at);

-- Done! Reviews can now exist without products and will persist after product deletion.
