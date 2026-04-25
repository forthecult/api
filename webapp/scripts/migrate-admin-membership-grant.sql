-- Admin-granted membership: tier and expiry for a customer (one per user).
-- Run: psql $DATABASE_URL -f scripts/migrate-admin-membership-grant.sql

CREATE TABLE IF NOT EXISTS admin_membership_grant (
  user_id text NOT NULL PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  tier integer NOT NULL,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

COMMENT ON TABLE admin_membership_grant IS 'Admin-granted membership (tier 1–3) until expires_at; used for checkout/tier resolution';
