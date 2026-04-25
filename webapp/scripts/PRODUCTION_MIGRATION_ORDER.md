# Production: membership billing legacy cleanup

Run these **in order** against the production database (e.g. `psql` or Supabase SQL editor). Use a maintenance window if you prefer.

## 1. Catalog / prerequisites (if not already applied)

- `migrate-subscription-plan-metadata.sql` (if your DB predates plan metadata)
- `migrate-subscription-catalog.sql` (if needed)
- Ensure membership catalog is seeded (offer `sub_offer_membership`, plans `mem_plan_*`) — e.g. first deploy with `ensureMembershipCatalogSeeded` or run your seed path.

## 2. Copy legacy rows into `subscription_instance`

```bash
psql "$DATABASE_URL" -f webapp/scripts/migrate-membership-subscription-to-instance.sql
```

Verify counts: old `membership_subscription` rows should have matching `subscription_instance` ids (see `WHERE NOT EXISTS` guard in that script).

## 3. Drop legacy billing mirror tables (Polar)

Polar tables are not used by the app; they may still exist from older experiments.

```bash
psql "$DATABASE_URL" -f webapp/scripts/migrate-drop-polar-tables.sql
```

## 4. Drop legacy `membership_subscription` table

Only after step 2 is verified.

```bash
psql "$DATABASE_URL" -f webapp/scripts/migrate-drop-membership-subscription-table.sql
```

## 5. Row Level Security (optional)

If you use `scripts/migrate-enable-rls-auth-tables.sql`, re-run it after deploying code that **no longer** references `polar_customer` / `polar_subscription` (those `ALTER TABLE` lines were removed from the script when Polar was dropped).

---

**Optional one-shot:** `migrate-legacy-billing-unconditional-drops.sql` runs Polar + `membership_subscription` drops in one transaction (same effect as running `migrate-drop-polar-tables.sql` then `migrate-drop-membership-subscription-table.sql`, without the data-migration step).

## Admin operations (clarification)

- **Comped / manual tier (not Stripe):** `POST` and `DELETE` `/api/admin/customers/[id]/membership/grant` — updates `admin_membership_grant` (time-boxed tier for support / promos).
- **Paid recurring membership:** stored in `subscription_instance` (offer slug `membership`). Admins can **cancel** the provider subscription and mark the row canceled via:
  - `POST /api/admin/membership/subscriptions/[subscriptionId]/cancel`
  - Uses `~/lib/admin-cancel-membership-subscription` (Stripe cancel, PayPal cancel, then DB `status = canceled`).

Listing paid subs: `GET /api/admin/membership/subscriptions`.

**Giving someone a paid Stripe subscription** is not the same as “grant”: it normally requires checkout or a Stripe Dashboard operation. Use comped grant for manual access, or document your internal Stripe workflow if you need true subscription creation from admin.
