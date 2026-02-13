-- Allow guest checkout: esim_order.user_id can be NULL when order is placed without login.
-- Run: psql $DATABASE_URL -f scripts/migrate-esim-order-user-id-nullable.sql

ALTER TABLE esim_order
  ALTER COLUMN user_id DROP NOT NULL;
