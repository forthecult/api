-- Move Pacsafe backpack products from Bags to Backpacks category.
-- Product IDs: pacsafe-exp-28l, pacsafe-v-20l, pacsafe-v-12l (from seed-data).

-- Remove links to accessories-bags
DELETE FROM product_category
WHERE product_id IN ('pacsafe-exp-28l', 'pacsafe-v-20l', 'pacsafe-v-12l')
  AND category_id = 'accessories-bags';

-- Add links to accessories-backpacks (is_main = true for primary category)
INSERT INTO product_category (product_id, category_id, is_main)
VALUES
  ('pacsafe-exp-28l', 'accessories-backpacks', true),
  ('pacsafe-v-20l', 'accessories-backpacks', true),
  ('pacsafe-v-12l', 'accessories-backpacks', true)
ON CONFLICT (product_id, category_id) DO UPDATE SET is_main = true;
