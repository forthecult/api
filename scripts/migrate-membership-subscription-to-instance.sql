-- One-time: copy legacy `membership_subscription` rows into `subscription_instance`.
-- Prerequisites:
--   1. Run migrate-subscription-plan-metadata.sql if needed.
--   2. Seed membership catalog (e.g. open /membership once, or deploy so ensureMembershipCatalogSeeded runs).
--   3. Offer id `sub_offer_membership` and plan ids `mem_plan_{tier}_{m|a}` must exist.

INSERT INTO subscription_instance (
  id,
  user_id,
  offer_id,
  plan_id,
  billing_provider,
  stripe_customer_id,
  stripe_subscription_id,
  paypal_subscription_id,
  stripe_price_id,
  status,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  last_order_id,
  created_at,
  updated_at
)
SELECT
  ms.id,
  ms.user_id,
  'sub_offer_membership',
  CASE
    WHEN ms.tier = 1 AND ms.interval = 'monthly' THEN 'mem_plan_1_m'
    WHEN ms.tier = 1 AND ms.interval = 'annual' THEN 'mem_plan_1_a'
    WHEN ms.tier = 2 AND ms.interval = 'monthly' THEN 'mem_plan_2_m'
    WHEN ms.tier = 2 AND ms.interval = 'annual' THEN 'mem_plan_2_a'
    WHEN ms.tier = 3 AND ms.interval = 'monthly' THEN 'mem_plan_3_m'
    WHEN ms.tier = 3 AND ms.interval = 'annual' THEN 'mem_plan_3_a'
    ELSE 'mem_plan_3_m'
  END,
  ms.billing_provider,
  ms.stripe_customer_id,
  ms.stripe_subscription_id,
  ms.paypal_subscription_id,
  ms.stripe_price_id,
  ms.status,
  ms.current_period_start,
  ms.current_period_end,
  ms.cancel_at_period_end,
  NULL,
  ms.created_at,
  ms.updated_at
FROM membership_subscription ms
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_instance si WHERE si.id = ms.id
);

-- Optional: drop legacy table after verifying data (uncomment when ready):
-- DROP TABLE membership_subscription;
