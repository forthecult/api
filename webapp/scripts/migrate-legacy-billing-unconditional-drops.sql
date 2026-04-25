-- One transaction: drop Polar mirror tables + legacy membership_subscription.
-- Prerequisites:
--   1. Data copied to subscription_instance (migrate-membership-subscription-to-instance.sql).
--   2. You have verified subscription_instance in production.
-- Safe to re-run: IF EXISTS on all drops.

BEGIN;

DROP TABLE IF EXISTS polar_subscription;
DROP TABLE IF EXISTS polar_customer;
DROP TABLE IF EXISTS membership_subscription;

COMMIT;
