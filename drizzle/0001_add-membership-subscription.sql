-- membership_subscription table for Stripe-based recurring memberships
CREATE TABLE IF NOT EXISTS "membership_subscription" (
  "id"                     TEXT PRIMARY KEY,
  "user_id"                TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "stripe_customer_id"     TEXT NOT NULL,
  "stripe_subscription_id" TEXT NOT NULL UNIQUE,
  "stripe_price_id"        TEXT NOT NULL,
  "tier"                   INTEGER NOT NULL,
  "interval"               TEXT NOT NULL,
  "status"                 TEXT NOT NULL,
  "current_period_start"   TIMESTAMP NOT NULL,
  "current_period_end"     TIMESTAMP NOT NULL,
  "cancel_at_period_end"   BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at"             TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at"             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "membership_subscription_user_id_idx"
  ON "membership_subscription" ("user_id");
CREATE INDEX IF NOT EXISTS "membership_subscription_status_idx"
  ON "membership_subscription" ("status");
