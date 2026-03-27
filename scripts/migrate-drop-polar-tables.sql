-- Drop legacy Polar billing mirror tables (unused by application code).
-- Run after deploying code that removes `polar_customer` / `polar_subscription` from Drizzle schema.
-- Safe to re-run: uses IF EXISTS.

BEGIN;

DROP TABLE IF EXISTS polar_subscription;
DROP TABLE IF EXISTS polar_customer;

COMMIT;
