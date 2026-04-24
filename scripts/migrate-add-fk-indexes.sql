-- Add btree indexes for foreign keys flagged by the Supabase performance
-- advisor `unindexed_foreign_keys` (lint 0001).
--
-- Each index covers exactly the FK column so joins and referential-integrity
-- checks (ON DELETE / ON UPDATE of the parent row) can seek instead of scan
-- the child table. Composite PKs/uniques that already lead with the FK
-- column are skipped — listing them again would just shadow the existing
-- index. All statements are idempotent.
--
-- Usage:
--   Supabase: already applied via the `add_missing_foreign_key_indexes`
--             migration. Kept here as the canonical script for other targets.
--   psql:     psql "$DATABASE_URL" -f webapp/scripts/migrate-add-fk-indexes.sql

CREATE INDEX IF NOT EXISTS affiliate_user_id_idx                    ON public.affiliate (user_id);
CREATE INDEX IF NOT EXISTS ai_rag_chunk_user_id_idx                 ON public.ai_rag_chunk (user_id);
CREATE INDEX IF NOT EXISTS blog_post_author_id_idx                  ON public.blog_post (author_id);
CREATE INDEX IF NOT EXISTS category_parent_id_idx                   ON public.category (parent_id);
CREATE INDEX IF NOT EXISTS category_token_gate_category_id_idx      ON public.category_token_gate (category_id);
CREATE INDEX IF NOT EXISTS coupon_category_category_id_idx          ON public.coupon_category (category_id);
CREATE INDEX IF NOT EXISTS coupon_product_product_id_idx            ON public.coupon_product (product_id);
CREATE INDEX IF NOT EXISTS custom_print_order_id_idx                ON public.custom_print (order_id);
CREATE INDEX IF NOT EXISTS custom_print_user_id_idx                 ON public.custom_print (user_id);
CREATE INDEX IF NOT EXISTS customer_comment_author_id_idx           ON public.customer_comment (author_id);
CREATE INDEX IF NOT EXISTS member_tier_discount_category_id_idx     ON public.member_tier_discount (category_id);
CREATE INDEX IF NOT EXISTS member_tier_discount_product_id_idx      ON public.member_tier_discount (product_id);
CREATE INDEX IF NOT EXISTS membership_esim_claim_esim_order_id_idx  ON public.membership_esim_claim (esim_order_id);
CREATE INDEX IF NOT EXISTS membership_tier_history_user_id_idx      ON public.membership_tier_history (user_id);
CREATE INDEX IF NOT EXISTS order_affiliate_id_idx                   ON public."order" (affiliate_id);
CREATE INDEX IF NOT EXISTS order_shipping_option_id_idx             ON public."order" (shipping_option_id);
CREATE INDEX IF NOT EXISTS order_item_order_id_idx                  ON public.order_item (order_id);
CREATE INDEX IF NOT EXISTS order_item_product_id_idx                ON public.order_item (product_id);
CREATE INDEX IF NOT EXISTS order_item_product_variant_id_idx        ON public.order_item (product_variant_id);
CREATE INDEX IF NOT EXISTS product_review_user_id_idx               ON public.product_review (user_id);
CREATE INDEX IF NOT EXISTS shipping_option_brand_id_idx             ON public.shipping_option (brand_id);
CREATE INDEX IF NOT EXISTS solana_wallet_stake_claimed_user_id_idx  ON public.solana_wallet_stake_claimed (user_id);
CREATE INDEX IF NOT EXISTS subscription_instance_offer_id_idx       ON public.subscription_instance (offer_id);
CREATE INDEX IF NOT EXISTS subscription_offer_product_id_idx        ON public.subscription_offer (product_id);
CREATE INDEX IF NOT EXISTS subscription_plan_crypto_product_id_idx  ON public.subscription_plan (crypto_product_id);
CREATE INDEX IF NOT EXISTS support_chat_conversation_taken_over_by_idx ON public.support_chat_conversation (taken_over_by);
CREATE INDEX IF NOT EXISTS support_chat_conversation_user_id_idx    ON public.support_chat_conversation (user_id);
CREATE INDEX IF NOT EXISTS support_chat_message_conversation_id_idx ON public.support_chat_message (conversation_id);
CREATE INDEX IF NOT EXISTS support_chat_message_user_id_idx         ON public.support_chat_message (user_id);
CREATE INDEX IF NOT EXISTS support_ticket_message_ticket_id_idx     ON public.support_ticket_message (ticket_id);
CREATE INDEX IF NOT EXISTS support_ticket_message_user_id_idx       ON public.support_ticket_message (user_id);
CREATE INDEX IF NOT EXISTS user_wallet_user_id_idx                  ON public.user_wallet (user_id);
CREATE INDEX IF NOT EXISTS wishlist_product_id_idx                  ON public.wishlist (product_id);
