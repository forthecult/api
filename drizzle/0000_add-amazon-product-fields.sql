CREATE TYPE "public"."type" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TABLE "address" (
	"address1" text NOT NULL,
	"address2" text,
	"city" text NOT NULL,
	"country_code" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"label" text,
	"phone" text,
	"state_code" text,
	"updated_at" timestamp NOT NULL,
	"user_id" text NOT NULL,
	"zip" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_attribution" (
	"affiliate_id" text NOT NULL,
	"converted_at" timestamp,
	"created_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"ip_address" text,
	"landing_page" text,
	"order_id" text,
	"referrer" text,
	"visitor_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate" (
	"admin_note" text,
	"application_note" text,
	"code" text NOT NULL,
	"commission_type" text DEFAULT 'percent' NOT NULL,
	"commission_value" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp NOT NULL,
	"customer_discount_type" text,
	"customer_discount_value" integer,
	"id" text PRIMARY KEY NOT NULL,
	"payout_address" text,
	"payout_method" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_earned_cents" integer DEFAULT 0 NOT NULL,
	"total_paid_cents" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp NOT NULL,
	"user_id" text,
	CONSTRAINT "affiliate_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "agent_preference" (
	"key" text NOT NULL,
	"moltbook_agent_id" text NOT NULL,
	"updated_at" timestamp NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "agent_preference_moltbook_agent_id_key_pk" PRIMARY KEY("moltbook_agent_id","key")
);
--> statement-breakpoint
CREATE TABLE "brand_asset" (
	"brand_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"type" text DEFAULT 'other' NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"featured" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"logo_url" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"website_url" text,
	CONSTRAINT "brand_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "category" (
	"created_at" timestamp NOT NULL,
	"description" text,
	"featured" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"image_url" text,
	"level" integer DEFAULT 1 NOT NULL,
	"meta_description" text,
	"name" text NOT NULL,
	"parent_id" text,
	"seo_optimized" boolean DEFAULT false NOT NULL,
	"slug" text,
	"title" text,
	"token_gate_contract_address" text,
	"token_gated" boolean DEFAULT false NOT NULL,
	"token_gate_network" text,
	"token_gate_quantity" integer,
	"token_gate_type" text,
	"updated_at" timestamp NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	CONSTRAINT "category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "category_auto_assign_rule" (
	"brand" text,
	"category_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"created_within_days" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"tag_contains" text,
	"title_contains" text,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_token_gate" (
	"category_id" text NOT NULL,
	"contract_address" text,
	"id" text PRIMARY KEY NOT NULL,
	"network" text,
	"quantity" integer NOT NULL,
	"token_symbol" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_category" (
	"category_id" text NOT NULL,
	"is_main" boolean DEFAULT false NOT NULL,
	"product_id" text NOT NULL,
	"sort_order" integer,
	CONSTRAINT "product_category_product_id_category_id_pk" PRIMARY KEY("product_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "coupon_category" (
	"category_id" text NOT NULL,
	"coupon_id" text NOT NULL,
	CONSTRAINT "coupon_category_coupon_id_category_id_pk" PRIMARY KEY("coupon_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "coupon_product" (
	"coupon_id" text NOT NULL,
	"product_id" text NOT NULL,
	CONSTRAINT "coupon_product_coupon_id_product_id_pk" PRIMARY KEY("coupon_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "coupon_redemption" (
	"coupon_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text,
	"phone" text,
	"shipping_address_hash" text,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "coupon" (
	"applies_to" text NOT NULL,
	"buy_quantity" integer,
	"code" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"date_end" timestamp,
	"date_start" timestamp,
	"discount_kind" text DEFAULT 'amount_off_order' NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"get_discount_type" text,
	"get_discount_value" integer,
	"get_quantity" integer,
	"id" text PRIMARY KEY NOT NULL,
	"label" text,
	"max_uses" integer,
	"max_uses_per_customer" integer,
	"max_uses_per_customer_type" text,
	"method" text DEFAULT 'code' NOT NULL,
	"rule_applies_to_esim" integer,
	"rule_order_total_max_cents" integer,
	"rule_order_total_min_cents" integer,
	"rule_payment_method_key" text,
	"rule_product_count_max" integer,
	"rule_product_count_min" integer,
	"rule_shipping_max_cents" integer,
	"rule_shipping_min_cents" integer,
	"rule_subtotal_max_cents" integer,
	"rule_subtotal_min_cents" integer,
	"token_holder_chain" text,
	"token_holder_min_balance" text,
	"token_holder_token_address" text,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "coupon_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "customer_comment" (
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"customer_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_esim_claim" (
	"created_at" timestamp NOT NULL,
	"esim_order_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"stake_period_key" text NOT NULL,
	"status" text DEFAULT 'claimed' NOT NULL,
	"tier" integer NOT NULL,
	"user_id" text NOT NULL,
	"wallet" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esim_order" (
	"activated_at" timestamp,
	"activation_link" text,
	"cost_cents" integer NOT NULL,
	"country_name" text,
	"created_at" timestamp NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"data_quantity" integer NOT NULL,
	"data_unit" text NOT NULL,
	"esim_id" text,
	"esim_order_id" integer,
	"expires_at" timestamp,
	"iccid" text,
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text,
	"package_id" text NOT NULL,
	"package_name" text NOT NULL,
	"package_type" text NOT NULL,
	"payment_method" text NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"price_cents" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"stripe_payment_intent_id" text,
	"updated_at" timestamp NOT NULL,
	"user_id" text,
	"validity_days" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_fee_distribution" (
	"created_at" timestamp NOT NULL,
	"fee_wallet_balance" bigint,
	"id" text PRIMARY KEY NOT NULL,
	"recipient_count" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_sol_lamports" bigint NOT NULL,
	"tx_signatures" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_fee_payout" (
	"distribution_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"share_percent" text NOT NULL,
	"sol_lamports" bigint NOT NULL,
	"staked_tokens" bigint NOT NULL,
	"tx_signature" text,
	"wallet" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance_proposal" (
	"created_at" timestamp NOT NULL,
	"created_by" text,
	"description" text NOT NULL,
	"end_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"start_at" timestamp NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance_vote" (
	"choice" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"voting_power" bigint NOT NULL,
	"wallet_address" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_tier_discount" (
	"applies_to_esim" integer,
	"category_id" text,
	"created_at" timestamp NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"label" text,
	"member_tier" integer NOT NULL,
	"product_id" text,
	"scope" text NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_tier_history" (
	"snapshot_date" date NOT NULL,
	"wallet" text NOT NULL,
	"user_id" text,
	"tier" integer,
	"staked_amount_raw" bigint DEFAULT 0 NOT NULL,
	"lock_duration_seconds" bigint,
	"locked_until_ts" bigint,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "membership_tier_history_wallet_date_pk" PRIMARY KEY("wallet","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "user_notification" (
	"created_at" timestamp NOT NULL,
	"description" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"metadata" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_print" (
	"blueprint_id" text,
	"blueprint_title" text,
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp,
	"external_product_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"image_url" text,
	"order_id" text,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"order_id" text NOT NULL,
	"price_cents" integer NOT NULL,
	"product_id" text,
	"product_variant_id" text,
	"quantity" integer NOT NULL,
	"source" text DEFAULT 'store' NOT NULL,
	"amazon_asin" text,
	"amazon_product_url" text,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "order" (
	"affiliate_code" text,
	"affiliate_commission_cents" integer,
	"affiliate_discount_cents" integer,
	"affiliate_id" text,
	"btcpay_invoice_id" text,
	"btcpay_invoice_url" text,
	"chain_id" integer,
	"created_at" timestamp NOT NULL,
	"crypto_amount" text,
	"crypto_currency" text,
	"crypto_currency_network" text,
	"crypto_tx_hash" text,
	"customer_note" text,
	"delivered_at" timestamp,
	"discount_percent" integer DEFAULT 0 NOT NULL,
	"email" text NOT NULL,
	"estimated_delivery_from" text,
	"estimated_delivery_to" text,
	"fulfillment_status" text,
	"id" text PRIMARY KEY NOT NULL,
	"internal_notes" text,
	"moltbook_agent_id" text,
	"payer_wallet_address" text,
	"payment_method" text DEFAULT 'stripe' NOT NULL,
	"payment_status" text,
	"printful_cost_shipping_cents" integer,
	"printful_cost_tax_cents" integer,
	"printful_cost_total_cents" integer,
	"printful_order_id" text,
	"printify_cost_shipping_cents" integer,
	"printify_cost_tax_cents" integer,
	"printify_cost_total_cents" integer,
	"printify_order_id" text,
	"has_amazon_items" boolean DEFAULT false NOT NULL,
	"amazon_order_id" text,
	"shipped_at" timestamp,
	"shipping_address1" text,
	"shipping_address2" text,
	"shipping_city" text,
	"shipping_country_code" text,
	"shipping_fee_cents" integer DEFAULT 0 NOT NULL,
	"shipping_method" text,
	"shipping_name" text,
	"shipping_option_id" text,
	"shipping_phone" text,
	"shipping_state_code" text,
	"shipping_zip" text,
	"solana_pay_deposit_address" text,
	"solana_pay_reference" text,
	"status" text NOT NULL,
	"stripe_checkout_session_id" text,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"telegram_first_name" text,
	"telegram_user_id" text,
	"telegram_username" text,
	"total_cents" integer NOT NULL,
	"tracking_carrier" text,
	"tracking_events_json" jsonb,
	"tracking_number" text,
	"tracking_url" text,
	"updated_at" timestamp NOT NULL,
	"user_id" text,
	CONSTRAINT "order_printful_order_id_unique" UNIQUE("printful_order_id"),
	CONSTRAINT "order_printify_order_id_unique" UNIQUE("printify_order_id"),
	CONSTRAINT "order_amazon_order_id_unique" UNIQUE("amazon_order_id"),
	CONSTRAINT "order_solana_pay_deposit_address_unique" UNIQUE("solana_pay_deposit_address"),
	CONSTRAINT "order_solana_pay_reference_unique" UNIQUE("solana_pay_reference"),
	CONSTRAINT "order_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id")
);
--> statement-breakpoint
CREATE TABLE "product_available_country" (
	"country_code" text NOT NULL,
	"product_id" text NOT NULL,
	CONSTRAINT "product_available_country_product_id_country_code_pk" PRIMARY KEY("product_id","country_code")
);
--> statement-breakpoint
CREATE TABLE "product_image" (
	"alt" text,
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"title" text,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_tag" (
	"product_id" text NOT NULL,
	"tag" text NOT NULL,
	CONSTRAINT "product_tag_product_id_tag_pk" PRIMARY KEY("product_id","tag")
);
--> statement-breakpoint
CREATE TABLE "product_token_gate" (
	"contract_address" text,
	"id" text PRIMARY KEY NOT NULL,
	"network" text,
	"product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"token_symbol" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variant" (
	"availability_status" text,
	"color" text,
	"color_code" text,
	"color_code2" text,
	"created_at" timestamp NOT NULL,
	"external_id" text,
	"gender" text,
	"id" text PRIMARY KEY NOT NULL,
	"image_alt" text,
	"image_title" text,
	"image_url" text,
	"label" text,
	"price_cents" integer NOT NULL,
	"printful_sync_variant_id" bigint,
	"printify_variant_id" text,
	"product_id" text NOT NULL,
	"size" text,
	"sku" text,
	"stock_quantity" integer,
	"updated_at" timestamp NOT NULL,
	"weight_grams" integer,
	CONSTRAINT "product_variant_printful_unique" UNIQUE("product_id","printful_sync_variant_id"),
	CONSTRAINT "product_variant_printify_unique" UNIQUE("product_id","printify_variant_id")
);
--> statement-breakpoint
CREATE TABLE "product" (
	"ai_generated" boolean DEFAULT false,
	"amazon_asin" text,
	"amazon_price_refreshed_at" timestamp,
	"barcode" text,
	"brand" text,
	"compare_at_price_cents" integer,
	"continue_selling_when_out_of_stock" boolean DEFAULT false NOT NULL,
	"cost_per_item_cents" integer,
	"country_of_origin" text,
	"created_at" timestamp NOT NULL,
	"description" text,
	"external_id" text,
	"features_json" text,
	"gpsr_json" jsonb,
	"handling_days_max" integer,
	"handling_days_min" integer,
	"has_variants" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"hs_code" text,
	"id" text PRIMARY KEY NOT NULL,
	"image_url" text,
	"is_discontinued" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp,
	"main_image_alt" text,
	"main_image_title" text,
	"meta_description" text,
	"model" text,
	"name" text NOT NULL,
	"option_definitions_json" text,
	"page_layout" text DEFAULT 'default',
	"page_title" text,
	"physical_product" boolean DEFAULT true NOT NULL,
	"price_cents" integer NOT NULL,
	"printful_sync_product_id" bigint,
	"printify_economy_eligible" boolean DEFAULT false NOT NULL,
	"printify_economy_enabled" boolean DEFAULT false NOT NULL,
	"printify_express_eligible" boolean DEFAULT false NOT NULL,
	"printify_express_enabled" boolean DEFAULT false NOT NULL,
	"printify_print_provider_id" integer,
	"printify_product_id" text,
	"product_type" text,
	"published" boolean DEFAULT true NOT NULL,
	"quantity" integer,
	"seo_optimized" boolean DEFAULT false NOT NULL,
	"ships_from_city" text,
	"ships_from_country" text,
	"ships_from_display" text,
	"ships_from_postal_code" text,
	"ships_from_region" text,
	"size_guide_json" text,
	"sku" text,
	"slug" text,
	"source" text NOT NULL,
	"source_image_url" text,
	"stripe_price_id" text,
	"token_gate_contract_address" text,
	"token_gated" boolean DEFAULT false NOT NULL,
	"token_gate_network" text,
	"token_gate_quantity" integer,
	"token_gate_type" text,
	"track_quantity" boolean DEFAULT false NOT NULL,
	"transit_days_max" integer,
	"transit_days_min" integer,
	"updated_at" timestamp NOT NULL,
	"vendor" text,
	"weight_grams" integer,
	"weight_unit" text,
	CONSTRAINT "product_printful_sync_product_id_unique" UNIQUE("printful_sync_product_id"),
	CONSTRAINT "product_printify_product_id_unique" UNIQUE("printify_product_id"),
	CONSTRAINT "product_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "refund_request" (
	"created_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"refund_address" text,
	"status" text NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_method_setting" (
	"created_at" timestamp NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"enabled_networks" jsonb,
	"label" text NOT NULL,
	"method_key" text PRIMARY KEY NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polar_customer" (
	"created_at" timestamp NOT NULL,
	"customer_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"updated_at" timestamp NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "polar_customer_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "polar_subscription" (
	"created_at" timestamp NOT NULL,
	"customer_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"status" text NOT NULL,
	"subscription_id" text NOT NULL,
	"updated_at" timestamp NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "polar_subscription_subscription_id_unique" UNIQUE("subscription_id")
);
--> statement-breakpoint
CREATE TABLE "product_review" (
	"author" text,
	"comment" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"customer_name" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"location" text,
	"product_id" text,
	"product_name" text,
	"product_slug" text,
	"rating" integer NOT NULL,
	"show_name" boolean DEFAULT true NOT NULL,
	"title" text,
	"updated_at" timestamp NOT NULL,
	"user_id" text,
	"visible" boolean DEFAULT true NOT NULL,
	CONSTRAINT "rating_range" CHECK ("product_review"."rating" >= 1 AND "product_review"."rating" <= 5)
);
--> statement-breakpoint
CREATE TABLE "shipping_option" (
	"additional_item_cents" integer,
	"amount_cents" integer,
	"brand_id" text,
	"country_code" text,
	"created_at" timestamp NOT NULL,
	"estimated_days_text" text,
	"id" text PRIMARY KEY NOT NULL,
	"max_order_cents" integer,
	"max_quantity" integer,
	"max_weight_grams" integer,
	"min_order_cents" integer,
	"min_quantity" integer,
	"min_weight_grams" integer,
	"name" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"source_url" text,
	"speed" text DEFAULT 'standard' NOT NULL,
	"type" text NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "size_chart" (
	"brand" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"data_imperial" jsonb,
	"data_metric" jsonb,
	"display_name" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"provider" text NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "size_chart_provider_brand_model_unique" UNIQUE("provider","brand","model")
);
--> statement-breakpoint
CREATE TABLE "support_chat_conversation" (
	"created_at" timestamp NOT NULL,
	"guest_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'web' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"taken_over_by" text,
	"updated_at" timestamp NOT NULL,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "support_chat_message" (
	"content" text NOT NULL,
	"conversation_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "support_chat_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_ticket_message" (
	"content" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"ticket_id" text NOT NULL,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "support_ticket" (
	"created_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"subject" text NOT NULL,
	"type" text DEFAULT 'normal' NOT NULL,
	"updated_at" timestamp NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_token_gate" (
	"contract_address" text,
	"id" text PRIMARY KEY NOT NULL,
	"network" text,
	"page_slug" text NOT NULL,
	"quantity" integer NOT NULL,
	"token_symbol" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"type" "type" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"url" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"two_factor_enabled" boolean DEFAULT false,
	"age" integer,
	"first_name" text,
	"last_name" text,
	"marketing_ai_companion" boolean DEFAULT false,
	"marketing_discord" boolean DEFAULT false,
	"marketing_email" boolean DEFAULT true,
	"marketing_sms" boolean DEFAULT false,
	"marketing_telegram" boolean DEFAULT false,
	"marketing_website" boolean DEFAULT false,
	"phone" text,
	"receive_marketing" boolean DEFAULT false,
	"receive_order_notifications_via_telegram" boolean DEFAULT false,
	"receive_sms_marketing" boolean DEFAULT false,
	"role" text DEFAULT 'user',
	"theme" text DEFAULT 'system',
	"transactional_ai_companion" boolean DEFAULT false,
	"transactional_discord" boolean DEFAULT false,
	"transactional_email" boolean DEFAULT true,
	"transactional_sms" boolean DEFAULT false,
	"transactional_telegram" boolean DEFAULT false,
	"transactional_website" boolean DEFAULT true,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_wallet" (
	"address" text NOT NULL,
	"chain" text NOT NULL,
	"chain_id" integer,
	"created_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"label" text,
	"updated_at" timestamp NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "user_wallet_chain_address" UNIQUE("chain","address")
);
--> statement-breakpoint
CREATE TABLE "webhook_registration" (
	"created_at" timestamp NOT NULL,
	"events" text,
	"id" text PRIMARY KEY NOT NULL,
	"secret" text,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlist" (
	"created_at" timestamp NOT NULL,
	"product_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "wishlist_user_id_product_id_pk" PRIMARY KEY("user_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_attribution" ADD CONSTRAINT "affiliate_attribution_affiliate_id_affiliate_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate" ADD CONSTRAINT "affiliate_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_asset" ADD CONSTRAINT "brand_asset_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_auto_assign_rule" ADD CONSTRAINT "category_auto_assign_rule_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_token_gate" ADD CONSTRAINT "category_token_gate_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_category" ADD CONSTRAINT "coupon_category_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_category" ADD CONSTRAINT "coupon_category_coupon_id_coupon_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupon"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_product" ADD CONSTRAINT "coupon_product_coupon_id_coupon_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupon"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_product" ADD CONSTRAINT "coupon_product_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemption" ADD CONSTRAINT "coupon_redemption_coupon_id_coupon_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupon"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_comment" ADD CONSTRAINT "customer_comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_comment" ADD CONSTRAINT "customer_comment_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_esim_claim" ADD CONSTRAINT "membership_esim_claim_esim_order_id_esim_order_id_fk" FOREIGN KEY ("esim_order_id") REFERENCES "public"."esim_order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_esim_claim" ADD CONSTRAINT "membership_esim_claim_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esim_order" ADD CONSTRAINT "esim_order_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esim_order" ADD CONSTRAINT "esim_order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_fee_payout" ADD CONSTRAINT "creator_fee_payout_distribution_id_creator_fee_distribution_id_fk" FOREIGN KEY ("distribution_id") REFERENCES "public"."creator_fee_distribution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_vote" ADD CONSTRAINT "governance_vote_proposal_id_governance_proposal_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."governance_proposal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_tier_discount" ADD CONSTRAINT "member_tier_discount_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_tier_discount" ADD CONSTRAINT "member_tier_discount_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_tier_history" ADD CONSTRAINT "membership_tier_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification" ADD CONSTRAINT "user_notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_print" ADD CONSTRAINT "custom_print_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_print" ADD CONSTRAINT "custom_print_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_product_variant_id_product_variant_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_affiliate_id_affiliate_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliate"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_shipping_option_id_shipping_option_id_fk" FOREIGN KEY ("shipping_option_id") REFERENCES "public"."shipping_option"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_available_country" ADD CONSTRAINT "product_available_country_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tag" ADD CONSTRAINT "product_tag_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_token_gate" ADD CONSTRAINT "product_token_gate_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polar_customer" ADD CONSTRAINT "polar_customer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polar_subscription" ADD CONSTRAINT "polar_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_review" ADD CONSTRAINT "product_review_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_review" ADD CONSTRAINT "product_review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_option" ADD CONSTRAINT "shipping_option_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_chat_conversation" ADD CONSTRAINT "support_chat_conversation_taken_over_by_user_id_fk" FOREIGN KEY ("taken_over_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_chat_conversation" ADD CONSTRAINT "support_chat_conversation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_chat_message" ADD CONSTRAINT "support_chat_message_conversation_id_support_chat_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."support_chat_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_chat_message" ADD CONSTRAINT "support_chat_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_message" ADD CONSTRAINT "support_ticket_message_ticket_id_support_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_message" ADD CONSTRAINT "support_ticket_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_wallet" ADD CONSTRAINT "user_wallet_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "address_user_id_idx" ON "address" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "affiliate_attr_affiliate_id_idx" ON "affiliate_attribution" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "brand_asset_brand_id_idx" ON "brand_asset" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "category_auto_assign_rule_category_id_idx" ON "category_auto_assign_rule" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "product_category_category_id_idx" ON "product_category" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "product_category_product_id_is_main_idx" ON "product_category" USING btree ("product_id","is_main");--> statement-breakpoint
CREATE INDEX "coupon_redemption_coupon_id_idx" ON "coupon_redemption" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX "coupon_redemption_user_id_idx" ON "coupon_redemption" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customer_comment_customer_id_idx" ON "customer_comment" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "membership_esim_claim_user_idx" ON "membership_esim_claim" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "membership_esim_claim_wallet_idx" ON "membership_esim_claim" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX "membership_esim_claim_period_idx" ON "membership_esim_claim" USING btree ("wallet","stake_period_key");--> statement-breakpoint
CREATE INDEX "esim_order_user_id_idx" ON "esim_order" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "esim_order_order_id_idx" ON "esim_order" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "esim_order_status_idx" ON "esim_order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "esim_order_esim_id_idx" ON "esim_order" USING btree ("esim_id");--> statement-breakpoint
CREATE INDEX "creator_fee_distribution_created_at_idx" ON "creator_fee_distribution" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "creator_fee_payout_distribution_id_idx" ON "creator_fee_payout" USING btree ("distribution_id");--> statement-breakpoint
CREATE INDEX "creator_fee_payout_wallet_idx" ON "creator_fee_payout" USING btree ("wallet");--> statement-breakpoint
CREATE UNIQUE INDEX "governance_vote_proposal_wallet_idx" ON "governance_vote" USING btree ("proposal_id","wallet_address");--> statement-breakpoint
CREATE INDEX "notification_user_id_idx" ON "user_notification" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "order_user_id_created_at_idx" ON "order" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "order_email_idx" ON "order" USING btree ("email");--> statement-breakpoint
CREATE INDEX "order_moltbook_agent_id_idx" ON "order" USING btree ("moltbook_agent_id");--> statement-breakpoint
CREATE INDEX "order_status_idx" ON "order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_payment_status_idx" ON "order" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "product_image_product_id_idx" ON "product_image" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_token_gate_product_id_idx" ON "product_token_gate" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_variant_product_id_idx" ON "product_variant" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_published_hidden_idx" ON "product" USING btree ("published","hidden");--> statement-breakpoint
CREATE INDEX "product_name_idx" ON "product" USING btree ("name");--> statement-breakpoint
CREATE INDEX "refund_request_order_id_idx" ON "refund_request" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "refund_request_status_idx" ON "refund_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refund_request_created_at_idx" ON "refund_request" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "product_review_product_id_idx" ON "product_review" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_review_product_slug_idx" ON "product_review" USING btree ("product_slug");--> statement-breakpoint
CREATE INDEX "product_review_visible_created_idx" ON "product_review" USING btree ("visible","created_at");--> statement-breakpoint
CREATE INDEX "support_ticket_user_id_idx" ON "support_ticket" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "upload_user_id_idx" ON "uploads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credentialID_idx" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");