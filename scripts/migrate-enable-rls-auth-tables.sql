-- Enable Row Level Security (RLS) on all public schema tables.
-- Tables in schemas exposed to PostgREST (e.g. Supabase) are flagged when RLS is disabled.
-- With RLS enabled and no permissive policies, only roles that bypass RLS
-- (e.g. service_role / your app's DB connection) can access the data.
-- See docs/RLS-TABLES.md for which tables are sensitive vs catalog/config.
--
-- Run this in Supabase SQL Editor or: psql -f webapp/scripts/migrate-enable-rls-auth-tables.sql

-- --- Auth (Better Auth) - SENSITIVE ---
ALTER TABLE public.account ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.two_factor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkey ENABLE ROW LEVEL SECURITY;

-- --- User-scoped / PII / secrets - SENSITIVE ---
ALTER TABLE public.address ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_preference ENABLE ROW LEVEL SECURITY;

-- --- Orders & payments - SENSITIVE ---
ALTER TABLE public."order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_method_setting ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_print ENABLE ROW LEVEL SECURITY;

-- --- Support - SENSITIVE ---
ALTER TABLE public.support_ticket ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_chat_conversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_chat_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_chat_setting ENABLE ROW LEVEL SECURITY;

-- --- Affiliates / internal - SENSITIVE ---
ALTER TABLE public.affiliate ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_registration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_comment ENABLE ROW LEVEL SECURITY;

-- --- eSIM & membership - SENSITIVE ---
ALTER TABLE public.esim_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_esim_claim ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_tier_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_tier_discount ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_membership_grant ENABLE ROW LEVEL SECURITY;

-- --- Governance (proposals may be public; votes & payouts sensitive) - SENSITIVE ---
ALTER TABLE public.governance_proposal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_vote ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_fee_distribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_fee_payout ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solana_wallet_stake_claimed ENABLE ROW LEVEL SECURITY;

-- --- Coupons (redemptions sensitive; definitions often admin-only) - SENSITIVE ---
ALTER TABLE public.coupon ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_product ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemption ENABLE ROW LEVEL SECURITY;

-- --- Content (RLS on for consistency; add SELECT policy if exposing via PostgREST) ---
ALTER TABLE public.blog_post ENABLE ROW LEVEL SECURITY;

-- --- Catalog / config (RLS on for consistency; add SELECT policy if exposing via PostgREST) ---
ALTER TABLE public.product ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_image ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_available_country ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_token_gate ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_review ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_token_gate ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_auto_assign_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_asset ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_option ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.size_chart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_token_gate ENABLE ROW LEVEL SECURITY;

-- --- Email (events, suppression, newsletter) - SENSITIVE ---
ALTER TABLE public.email_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_suppression ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscriber ENABLE ROW LEVEL SECURITY;
