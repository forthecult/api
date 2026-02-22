-- Solana wallets unlinked after staking: only the original user can re-link (prevents double stake).
-- Run: psql $DATABASE_URL -f scripts/migrate-solana-wallet-stake-claimed.sql

CREATE TABLE IF NOT EXISTS solana_wallet_stake_claimed (
  wallet text NOT NULL PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now()
);

COMMENT ON TABLE solana_wallet_stake_claimed IS 'Wallets unlinked after staking; only original user can re-link';
