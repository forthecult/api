# Row Level Security (RLS) – public schema

> Scope: reviewer reference for which tables are backend-only vs. candidates for PostgREST exposure. See [`../../SECURITY.md`](../../SECURITY.md) for the broader operator runbook and [`SECURITY-DEVELOPMENT-STANDARDS.md`](SECURITY-DEVELOPMENT-STANDARDS.md) for the customer-surface policy.

## Current state

**Both Supabase projects (FTC dev and FTC Production) have RLS enabled on every base table in `public`.** No RLS policies are attached by default. Supabase advisors `rls_disabled_in_public` and `sensitive_columns_exposed` are both clean.

Applied via migrations:

- `enable_rls_on_public_tables` – idempotent DO block that enables RLS on every `relkind = 'r'` in `public` where `relrowsecurity = false`.
- `add_missing_foreign_key_indexes` – covers every FK flagged by the `unindexed_foreign_keys` advisor.

Canonical versions of both scripts live at:

- `webapp/scripts/migrate-enable-rls-auth-tables.sql`
- `webapp/scripts/migrate-add-fk-indexes.sql`

## Why RLS-on / policies-off is safe for this app

The webapp connects **directly to Postgres** via Supavisor using `DATABASE_URL`, not through PostgREST. The `postgres` role has `BYPASSRLS = true`, so enabling RLS has no runtime effect on queries issued by the app. What it *does* block is any call hitting PostgREST as `anon` or `authenticated` — which is the threat model the Supabase advisor cares about.

Verified roles (production):

| Role             | `rolbypassrls` |
|------------------|----------------|
| `postgres`       | true           |
| `service_role`   | true           |
| `supabase_admin` | true           |
| `authenticator`  | false          |
| `authenticated`  | false          |
| `anon`           | false          |

## When to add policies

Only add a policy on a table if you intentionally want to expose it through PostgREST. Example (read-only public catalog):

```sql
CREATE POLICY "allow anon read"
  ON public.product
  FOR SELECT
  TO anon, authenticated
  USING (true);
```

Keep sensitive tables (auth, orders, payments, support, webhook secrets, etc.) **policy-free** so only BYPASSRLS roles can touch them.

## Rough table classification

| Class | Tables (examples) | Notes |
|-------|-------------------|-------|
| Auth / credentials | `account`, `user`, `session`, `verification`, `two_factor`, `passkey` | Keep policy-free. |
| User-scoped PII | `address`, `user_notification`, `user_wallet`, `wishlist`, `uploads`, `agent_preference` | Keep policy-free. |
| Orders & payments | `order`, `order_item`, `refund_request`, `payment_method_setting`, `custom_print`, `stripe_customer` | Keep policy-free. |
| Subscriptions | `subscription_plan`, `subscription_offer`, `subscription_instance` | Keep policy-free. |
| Support | `support_ticket`, `support_ticket_message`, `support_chat_conversation`, `support_chat_message`, `support_chat_setting` | May contain PII. Keep policy-free. |
| Affiliates / internal | `affiliate`, `affiliate_attribution`, `webhook_registration`, `customer_comment`, `slack_event_processed` | Keep policy-free. |
| eSIM & membership | `esim_order`, `membership_esim_claim`, `membership_tier_history`, `member_tier_discount`, `admin_membership_grant` | Keep policy-free. |
| Governance / payouts | `governance_proposal`, `governance_vote`, `creator_fee_distribution`, `creator_fee_payout`, `solana_wallet_stake_claimed` | Keep policy-free. |
| Coupons | `coupon`, `coupon_category`, `coupon_product`, `coupon_redemption` | Keep policy-free. |
| AI | `ai_agent`, `ai_memory`, `ai_rag_chunk`, `ai_chat_conversation`, `ai_messaging_channel`, `ai_messaging_user_link`, `ai_encrypted_backup`, `ai_guest_usage`, `ai_character_quota`, `ai_admin_prompt` | Keep policy-free. |
| Catalog / config | `product`, `product_variant`, `product_image`, `product_tag`, `product_available_country`, `product_token_gate`, `product_category`, `product_review`, `category`, `category_token_gate`, `category_auto_assign_rule`, `brand`, `brand_asset`, `shipping_option`, `size_chart`, `page_token_gate`, `blog_post` | Candidates for a read-only PostgREST SELECT policy if the storefront ever wants to query Supabase directly. |
