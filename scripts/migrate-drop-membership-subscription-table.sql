-- Drop legacy `membership_subscription` after rows are migrated to `subscription_instance`.
-- Run ONLY after:
--   1. `migrate-membership-subscription-to-instance.sql` (data copy)
--   2. Verifying subscription_instance rows in production
-- Safe to re-run: uses IF EXISTS.

BEGIN;

DROP TABLE IF EXISTS membership_subscription;

COMMIT;
