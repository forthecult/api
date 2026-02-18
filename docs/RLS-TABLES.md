# Row Level Security (RLS) – Table Classification

All tables in the `public` schema are exposed to PostgREST (e.g. Supabase). The migration `scripts/migrate-enable-rls-auth-tables.sql` enables RLS on **every** such table so that:

- No table is left without RLS (clears “RLS Disabled in Public” warnings).
- With RLS enabled and **no policies**, only roles that bypass RLS (e.g. `service_role` or your app’s DB connection) can read/write. Your app uses that connection, so behaviour is unchanged.

## Tables that MUST have RLS (sensitive – backend only)

These hold PII, auth data, payments, or secrets. They must **not** be readable or writable via PostgREST with anon/authenticated. No policies are added; only the backend (service role) can access them.

| Table | Reason |
|------|--------|
| **Auth** | |
| `account`, `user`, `session`, `verification`, `two_factor`, `passkey` | Better Auth; credentials, sessions, 2FA, passkeys |
| **User-scoped** | |
| `address`, `user_notification`, `user_wallet`, `wishlist`, `uploads`, `agent_preference` | Per-user data; PII or preferences |
| **Orders & payments** | |
| `order`, `order_item`, `refund_request`, `payment_method_setting`, `polar_customer`, `polar_subscription`, `custom_print` | Orders, payment methods, refunds |
| **Support** | |
| `support_ticket`, `support_ticket_message`, `support_chat_conversation`, `support_chat_message`, `support_chat_setting` | Customer support; may contain PII |
| **Affiliates / internal** | |
| `affiliate`, `affiliate_attribution`, `webhook_registration`, `customer_comment` | Affiliate data; webhook secrets; internal comments |
| **eSIM & membership** | |
| `esim_order`, `membership_esim_claim`, `membership_tier_history`, `member_tier_discount` | Purchases, claims, tier history |
| **Governance** | |
| `governance_proposal`, `governance_vote`, `creator_fee_distribution`, `creator_fee_payout` | Proposals, votes, payouts |
| **Coupons** | |
| `coupon`, `coupon_category`, `coupon_product`, `coupon_redemption` | Coupon definitions and redemptions |

## Tables that still have RLS enabled (catalog/config)

These are catalog or config tables. RLS is **enabled** so the “RLS Disabled in Public” warning is resolved. No policies are added by default, so only the backend can access them.

If you later want to expose **read-only** data via PostgREST (e.g. product/category listing for the storefront), you can add a policy on the specific table, for example:

```sql
CREATE POLICY "Allow public read" ON public.product FOR SELECT USING (true);
```

| Table | Notes |
|------|--------|
| `product`, `product_variant`, `product_image`, `product_tag`, `product_available_country`, `product_token_gate`, `product_category`, `product_review` | Product catalog and reviews |
| `category`, `category_token_gate`, `category_auto_assign_rule` | Category tree and token gates |
| `brand`, `brand_asset` | Brands and assets |
| `shipping_option`, `size_chart`, `page_token_gate` | Store config |

## Tables that do NOT need RLS

**None.** In this project every table lives in `public` and is exposed to PostgREST, so every table “needs” RLS enabled to satisfy the security check. The distinction above is:

- **Sensitive**: RLS on, no policies → backend only.
- **Catalog/config**: RLS on, no policies by default; add a SELECT policy only if you intentionally expose that table via PostgREST.

## Applying the migration

- **Supabase**: Dashboard → SQL Editor → paste contents of `webapp/scripts/migrate-enable-rls-auth-tables.sql` → Run.
- **Other Postgres**: `psql -f webapp/scripts/migrate-enable-rls-auth-tables.sql` (or your migration runner).

After running it, all “RLS Disabled in Public” findings for these tables should be resolved.
