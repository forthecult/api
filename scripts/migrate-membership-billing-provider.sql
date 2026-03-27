-- membership: support PayPal subscriptions alongside Stripe (nullable Stripe columns when provider = paypal)
alter table membership_subscription
  add column if not exists billing_provider text not null default 'stripe';

alter table membership_subscription
  add column if not exists paypal_subscription_id text;

alter table membership_subscription
  alter column stripe_customer_id drop not null;

alter table membership_subscription
  alter column stripe_subscription_id drop not null;

alter table membership_subscription
  alter column stripe_price_id drop not null;

create unique index if not exists membership_subscription_paypal_subscription_id_key
  on membership_subscription (paypal_subscription_id)
  where paypal_subscription_id is not null;
