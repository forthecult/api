-- Server-side cart snapshots for abandon-cart cron (signed-in shoppers).
-- Run: bun run db:migrate-cart-snapshot
-- Or rely on `bun run db:push` from Drizzle schema.

CREATE TABLE IF NOT EXISTS public.shopping_cart_snapshot (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  email text NOT NULL,
  items_json jsonb NOT NULL,
  subtotal_cents integer NOT NULL DEFAULT 0,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  purchase_completed_at timestamptz,
  abandon_enrolled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shopping_cart_snapshot_user_idx
  ON public.shopping_cart_snapshot (user_id);
CREATE INDEX IF NOT EXISTS shopping_cart_snapshot_idle_idx
  ON public.shopping_cart_snapshot (last_synced_at, purchase_completed_at, abandon_enrolled_at);
CREATE INDEX IF NOT EXISTS shopping_cart_snapshot_email_idx
  ON public.shopping_cart_snapshot (email);
