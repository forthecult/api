-- REQUIRED for guest eSIM checkout and Solana Pay. Run once per environment (staging, production).
-- Without this, INSERT into esim_order with user_id = NULL fails (NOT NULL violation).
-- Allow guest checkout: esim_order.user_id can be NULL when order is placed without login.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-esim-order-user-id-nullable.sql
-- Or:  bun run db:migrate-esim-order-guest

ALTER TABLE esim_order
  ALTER COLUMN user_id DROP NOT NULL;
