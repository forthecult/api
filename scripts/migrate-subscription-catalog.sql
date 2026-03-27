-- subscription catalog: reusable offers/plans + customer instances (Stripe / PayPal / manual crypto)

create table if not exists subscription_offer (
  id text primary key,
  slug text not null unique,
  name text not null,
  description text,
  product_id text references product(id) on delete set null,
  published boolean not null default true,
  metadata jsonb,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index if not exists subscription_offer_published_idx on subscription_offer(published);

create table if not exists subscription_plan (
  id text primary key,
  offer_id text not null references subscription_offer(id) on delete cascade,
  interval_unit text not null,
  interval_count integer not null default 1,
  price_cents integer not null,
  currency text not null default 'USD',
  display_name text,
  sort_order integer not null default 0,
  pay_stripe boolean not null default false,
  pay_paypal boolean not null default false,
  pay_crypto_manual boolean not null default false,
  stripe_price_id text,
  paypal_plan_id text,
  crypto_product_id text references product(id) on delete set null,
  published boolean not null default true,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index if not exists subscription_plan_offer_idx on subscription_plan(offer_id);

create table if not exists subscription_instance (
  id text primary key,
  user_id text not null references "user"(id) on delete cascade,
  offer_id text not null references subscription_offer(id) on delete restrict,
  plan_id text not null references subscription_plan(id) on delete restrict,
  billing_provider text not null,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  paypal_subscription_id text unique,
  stripe_price_id text,
  status text not null,
  current_period_start timestamp not null,
  current_period_end timestamp not null,
  cancel_at_period_end boolean not null default false,
  last_order_id text references "order"(id) on delete set null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index if not exists subscription_instance_user_idx on subscription_instance(user_id);
create index if not exists subscription_instance_plan_idx on subscription_instance(plan_id);

alter table "order" add column if not exists subscription_plan_id text references subscription_plan(id) on delete set null;
