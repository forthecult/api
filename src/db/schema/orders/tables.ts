import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { affiliateTable } from "../affiliates/tables";
import { shippingOptionsTable } from "../shipping/tables";
import { userTable } from "../users/tables";

export const productsTable = pgTable(
  "product",
  {
    // POD AI/creator: product created via POD bulk or AI flow
    aiGenerated: boolean("ai_generated").default(false),
    barcode: text("barcode"),
    brand: text("brand"),
    compareAtPriceCents: integer("compare_at_price_cents"),
    continueSellingWhenOutOfStock: boolean("continue_selling_when_out_of_stock")
      .notNull()
      .default(false),
    costPerItemCents: integer("cost_per_item_cents"),
    countryOfOrigin: text("country_of_origin"),
    createdAt: timestamp("created_at").notNull(),
    description: text("description"),
    externalId: text("external_id"), // printful: catalog_product_id / printify: blueprint_id
    /** Bullet-point features (JSON array of strings). Shown on product page; details go in description. */
    featuresJson: text("features_json"),
    /** GPSR (EU General Product Safety Regulation) compliance data — JSON from Printify /gpsr.json. */
    gpsrJson: jsonb("gpsr_json"),
    handlingDaysMax: integer("handling_days_max"),
    // Estimated delivery: fulfillment (handling) and transit days from vendor or manual
    handlingDaysMin: integer("handling_days_min"), // e.g. from Printify shipping.json
    hasVariants: boolean("has_variants").notNull().default(false),
    /** When true, product is still published but only reachable by direct slug URL; excluded from category and product listings. */
    hidden: boolean("hidden").notNull().default(false),
    hsCode: text("hs_code"),
    id: text("id").primaryKey(),
    imageUrl: text("image_url"),
    /** True when the underlying catalog product is discontinued by the manufacturer. Product should be hidden from storefront. */
    isDiscontinued: boolean("is_discontinued").notNull().default(false),
    // Last sync timestamp – when the product was last synced with the vendor
    lastSyncedAt: timestamp("last_synced_at"),
    /** SEO: alt text for main product image */
    mainImageAlt: text("main_image_alt"),
    /** SEO: title for main product image */
    mainImageTitle: text("main_image_title"),
    metaDescription: text("meta_description"),
    /** Blank product model (e.g. "3001") for size chart lookup. */
    model: text("model"),
    name: text("name").notNull(),
    optionDefinitionsJson: text("option_definitions_json"), // [{ name, values: string[] }]
    /** Product page layout: "default" (standard PDP) or "long-form" (hero, sections, specs, FAQ). */
    pageLayout: text("page_layout").default("default"),
    pageTitle: text("page_title"),
    physicalProduct: boolean("physical_product").notNull().default(true),
    priceCents: integer("price_cents").notNull(),
    // Printful Sync Product – stores the sync_product_id from Printful for bidirectional sync
    // BIGINT: Printful IDs can exceed 32-bit INTEGER max (2,147,483,647)
    printfulSyncProductId: bigint("printful_sync_product_id", {
      mode: "number",
    }).unique(),
    /** Whether the product is eligible for economy shipping. */
    printifyEconomyEligible: boolean("printify_economy_eligible")
      .notNull()
      .default(false),
    /** Whether economy shipping is enabled for this product. */
    printifyEconomyEnabled: boolean("printify_economy_enabled")
      .notNull()
      .default(false),
    // Printify shipping eligibility flags — synced from Printify product data
    /** Whether the product is eligible for Printify Express shipping. */
    printifyExpressEligible: boolean("printify_express_eligible")
      .notNull()
      .default(false),
    /** Whether Printify Express is enabled for this product. */
    printifyExpressEnabled: boolean("printify_express_enabled")
      .notNull()
      .default(false),
    // Printify print provider ID – required for Printify shipping calculation (catalog shipping profiles)
    printifyPrintProviderId: integer("printify_print_provider_id"),
    // Printify Product ID – stores the product ID from Printify for bidirectional sync
    printifyProductId: text("printify_product_id").unique(),
    /** Product type from POD catalog (e.g. T-SHIRT, HOODIE, MUG). Useful for filtering and SEO. */
    productType: text("product_type"),
    published: boolean("published").notNull().default(true),
    quantity: integer("quantity"), // simple product inventory when trackQuantity
    /** Admin-only: product has been optimized for SEO / content / copy. */
    seoOptimized: boolean("seo_optimized").notNull().default(false),
    shipsFromCity: text("ships_from_city"),
    shipsFromCountry: text("ships_from_country"), // ISO 2-letter or country name
    // Ships from: full address (when set) or composed from city/region/postal/country for display and shipping-time estimates
    shipsFromDisplay: text("ships_from_display"), // optional freeform full address
    shipsFromPostalCode: text("ships_from_postal_code"),
    shipsFromRegion: text("ships_from_region"), // state / province / region
    sizeGuideJson: text("size_guide_json"),
    sku: text("sku"),
    slug: text("slug").unique(),
    source: text("source").notNull(), // "manual" | "printful" | "printify"
    // Original design image URL (for POD-created products)
    sourceImageUrl: text("source_image_url"),
    stripePriceId: text("stripe_price_id"),
    tokenGateContractAddress: text("token_gate_contract_address"),

    tokenGated: boolean("token_gated").notNull().default(false),
    tokenGateNetwork: text("token_gate_network"), // solana | ethereum | base | arbitrum | bnb | polygon | avalanche
    tokenGateQuantity: integer("token_gate_quantity"),
    tokenGateType: text("token_gate_type"), // "cult_default" | "cult_custom" | "other"
    trackQuantity: boolean("track_quantity").notNull().default(false),
    transitDaysMax: integer("transit_days_max"),
    transitDaysMin: integer("transit_days_min"), // optional; fallback in UI if null
    updatedAt: timestamp("updated_at").notNull(),
    vendor: text("vendor"),
    weightGrams: integer("weight_grams"),
    weightUnit: text("weight_unit"), // "kg" | "lb"
  },
  (t) => [
    // M3: Composite index for filtering published & non-hidden products
    index("product_published_hidden_idx").on(t.published, t.hidden),
    // M4: Index for product name search (btree helps prefix ILIKE; for full trigram support use a GIN index via raw migration)
    index("product_name_idx").on(t.name),
  ],
);

export const productVariantsTable = pgTable(
  "product_variant",
  {
    /** Printful: "in_stock" | "out_of_stock" | etc. Synced on product_updated. */
    availabilityStatus: text("availability_status"),
    color: text("color"),
    colorCode: text("color_code"),
    /** Secondary color code (e.g. for two-tone products). From Printful catalog variant color_code2. */
    colorCode2: text("color_code2"),
    createdAt: timestamp("created_at").notNull(),
    externalId: text("external_id"), // printful: catalog_variant_id / printify: variant_id
    /** Gender/style option (e.g. Men's / Women's for Earth Runners). Used when product has 3 option dimensions. */
    gender: text("gender"),
    id: text("id").primaryKey(),
    /** SEO: alt text for variant image */
    imageAlt: text("image_alt"),
    /** SEO: title for variant image */
    imageTitle: text("image_title"),
    imageUrl: text("image_url"),
    /** Display label (e.g. Printful sync variant "name": "Product / Color / Size") */
    label: text("label"),
    priceCents: integer("price_cents").notNull(),
    // Printful Sync Variant ID – stores the sync_variant_id from Printful for bidirectional sync
    // BIGINT: Printful IDs can exceed 32-bit INTEGER max (2,147,483,647)
    printfulSyncVariantId: bigint("printful_sync_variant_id", {
      mode: "number",
    }),
    // Printify Variant ID – stores the variant ID from Printify for bidirectional sync
    printifyVariantId: text("printify_variant_id"),
    productId: text("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    size: text("size"),
    sku: text("sku"),
    stockQuantity: integer("stock_quantity"),

    updatedAt: timestamp("updated_at").notNull(),
    weightGrams: integer("weight_grams"),
  },
  (t) => [
    // Composite unique constraints: variant IDs are unique within a product, not globally
    // This allows the same external variant ID to exist across different products
    unique("product_variant_printful_unique").on(
      t.productId,
      t.printfulSyncVariantId,
    ),
    unique("product_variant_printify_unique").on(
      t.productId,
      t.printifyVariantId,
    ),
    // Index for faster variant lookups by product
    index("product_variant_product_id_idx").on(t.productId),
  ],
);

export const ordersTable = pgTable(
  "order",
  {
    affiliateCode: text("affiliate_code"),
    affiliateCommissionCents: integer("affiliate_commission_cents"),
    affiliateDiscountCents: integer("affiliate_discount_cents"),
    // Affiliate attribution
    affiliateId: text("affiliate_id").references(() => affiliateTable.id, {
      onDelete: "set null",
    }),
    // Payment — BTCPay Server (Bitcoin, Dogecoin, Monero via Bitpay-compatible API)
    btcpayInvoiceId: text("btcpay_invoice_id"),
    btcpayInvoiceUrl: text("btcpay_invoice_url"),
    chainId: integer("chain_id"), // EVM chain ID (1=ETH, 8453=Base)
    createdAt: timestamp("created_at").notNull(),
    cryptoAmount: text("crypto_amount"), // String for precision
    cryptoCurrency: text("crypto_currency"), // "SOL" | "ETH" | "USDC" | null
    cryptoCurrencyNetwork: text("crypto_currency_network"), // "Ethereum" | "Solana" | "Base" | etc.
    cryptoTxHash: text("crypto_tx_hash"),
    customerNote: text("customer_note"),
    deliveredAt: timestamp("delivered_at"),

    discountPercent: integer("discount_percent").notNull().default(0),
    email: text("email").notNull(),
    /** Estimated delivery window – earliest date (ISO date string, e.g. "2025-06-15"). */
    estimatedDeliveryFrom: text("estimated_delivery_from"),

    /** Estimated delivery window – latest date (ISO date string, e.g. "2025-06-20"). */
    estimatedDeliveryTo: text("estimated_delivery_to"),
    // TODO (L17): migrate fulfillmentStatus to pgEnum for type safety
    fulfillmentStatus: text("fulfillment_status"), // "unfulfilled" | "on_hold" | "partially_fulfilled" | "fulfilled"
    id: text("id").primaryKey(),
    internalNotes: text("internal_notes"),
    // Moltbook agent identity (when order placed with X-Moltbook-Identity)
    moltbookAgentId: text("moltbook_agent_id"),
    payerWalletAddress: text("payer_wallet_address"),
    paymentMethod: text("payment_method").notNull().default("stripe"), // "stripe" | "solana_pay" | "eth_pay" | "btcpay" | "ton_pay" | "paypal" | "crypto"
    // TODO (L17): migrate paymentStatus to pgEnum for type safety
    paymentStatus: text("payment_status"), // "pending" | "paid" | "refund_pending" | "refunded" | "cancelled"
    /** Printful shipping cost in cents (USD). */
    printfulCostShippingCents: integer("printful_cost_shipping_cents"),
    /** Printful tax/VAT cost in cents (USD). */
    printfulCostTaxCents: integer("printful_cost_tax_cents"),

    // --- Printful fulfillment costs (admin-only, wholesale cost to us) ---
    /** Printful total cost in cents (USD). Admin-only; not shown to customers. */
    printfulCostTotalCents: integer("printful_cost_total_cents"),

    printfulOrderId: text("printful_order_id").unique(),
    /** Printify shipping cost in cents (USD). */
    printifyCostShippingCents: integer("printify_cost_shipping_cents"),
    /** Printify tax cost in cents (USD). */
    printifyCostTaxCents: integer("printify_cost_tax_cents"),
    // --- Printify fulfillment costs (admin-only, wholesale cost to us) ---
    /** Printify total price in cents (USD). Admin-only; not shown to customers. */
    printifyCostTotalCents: integer("printify_cost_total_cents"),
    printifyOrderId: text("printify_order_id").unique(),
    shippedAt: timestamp("shipped_at"),
    shippingAddress1: text("shipping_address1"),
    shippingAddress2: text("shipping_address2"),
    shippingCity: text("shipping_city"),
    shippingCountryCode: text("shipping_country_code"), // ISO 2-letter
    shippingFeeCents: integer("shipping_fee_cents").notNull().default(0),

    shippingMethod: text("shipping_method"), // "standard" | "express" | Printful shipping ID
    // Shipping — Printful-compatible names
    shippingName: text("shipping_name"),

    // L16: ON DELETE set null so orders survive shipping option removal
    shippingOptionId: text("shipping_option_id").references(
      () => shippingOptionsTable.id,
      { onDelete: "set null" },
    ),
    shippingPhone: text("shipping_phone"), // Printful requires phone
    shippingStateCode: text("shipping_state_code"), // 2-letter
    shippingZip: text("shipping_zip"),
    // Payment — Solana / crypto
    solanaPayDepositAddress: text("solana_pay_deposit_address").unique(),
    solanaPayReference: text("solana_pay_reference").unique(),
    // TODO (L17): migrate status to pgEnum for type safety
    status: text("status").notNull(), // legacy: "pending" | "paid" | "fulfilled" | "cancelled" | "refund_pending" | "refunded"
    // Payment — Stripe
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),

    taxCents: integer("tax_cents").notNull().default(0),
    telegramFirstName: text("telegram_first_name"),
    // Telegram Mini App — for orders placed from Telegram
    telegramUserId: text("telegram_user_id"),

    telegramUsername: text("telegram_username"),
    totalCents: integer("total_cents").notNull(),
    trackingCarrier: text("tracking_carrier"),

    /** Shipment tracking events from fulfiller (JSON array of { triggered_at, description }). */
    trackingEventsJson: jsonb("tracking_events_json"),
    // --- Shipment tracking (all providers: Printful, Printify, manual) ---
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    updatedAt: timestamp("updated_at").notNull(),

    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    // Index for faster order lookups by user (sorted by most recent first)
    index("order_user_id_created_at_idx").on(t.userId, t.createdAt),
    // Index for email lookups (guest orders)
    index("order_email_idx").on(t.email),
    // Index for Moltbook agent "my orders"
    index("order_moltbook_agent_id_idx").on(t.moltbookAgentId),
    // Index for status filtering in admin
    index("order_status_idx").on(t.status),
    index("order_payment_status_idx").on(t.paymentStatus),
  ],
);

export const orderItemsTable = pgTable("order_item", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  orderId: text("order_id")
    .notNull()
    .references(() => ordersTable.id, { onDelete: "cascade" }),
  priceCents: integer("price_cents").notNull(),
  productId: text("product_id").references(() => productsTable.id, {
    onDelete: "set null",
  }),
  productVariantId: text("product_variant_id").references(
    () => productVariantsTable.id,
    { onDelete: "set null" },
  ),
  quantity: integer("quantity").notNull(),
});

/** Product media: multiple images per product with SEO (alt, title). */
export const productImagesTable = pgTable(
  "product_image",
  {
    alt: text("alt"),
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    title: text("title"),
    url: text("url").notNull(),
  },
  (t) => [
    // M7: Index for looking up images by product
    index("product_image_product_id_idx").on(t.productId),
  ],
);

/** Product tags (additional categorization). */
export const productTagsTable = pgTable(
  "product_tag",
  {
    productId: text("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.tag] })],
);

/** Markets: countries where the product is available (ISO 3166-1 alpha-2). Empty = available everywhere. */
export const productAvailableCountryTable = pgTable(
  "product_available_country",
  {
    countryCode: text("country_code").notNull(), // e.g. US, GB, DE
    productId: text("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.countryCode] })],
);

/** Multiple token gates per product: access if user holds >= quantity of ANY token (OR). */
export const productTokenGateTable = pgTable(
  "product_token_gate",
  {
    contractAddress: text("contract_address"),
    id: text("id").primaryKey(),
    network: text("network"),
    productId: text("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    tokenSymbol: text("token_symbol").notNull(), // e.g. CULT, PUMP, WHALE
  },
  (t) => [
    // M7: Index for looking up token gates by product
    index("product_token_gate_product_id_idx").on(t.productId),
  ],
);

/** One-off custom prints (not synced to store). Tracked for ordering only. */
export const customPrintsTable = pgTable("custom_print", {
  blueprintId: text("blueprint_id"),
  blueprintTitle: text("blueprint_title"),
  createdAt: timestamp("created_at").notNull(),
  expiresAt: timestamp("expires_at"), // optional: auto-cleanup if not ordered
  externalProductId: text("external_product_id").notNull(),
  id: text("id").primaryKey(),
  imageUrl: text("image_url"),
  orderId: text("order_id").references(() => ordersTable.id, {
    onDelete: "set null",
  }),
  provider: text("provider").notNull(), // "printify" | "printful"
  // TODO (L17): migrate status to pgEnum for type safety
  status: text("status").notNull(), // "created" | "ordered" | "fulfilled"
  userId: text("user_id").references(() => userTable.id, {
    onDelete: "set null",
  }),
});

/** Customer refund requests. Status: requested → approved/refunded/rejected. */
export const refundRequestsTable = pgTable(
  "refund_request",
  {
    createdAt: timestamp("created_at").notNull(),
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    refundAddress: text("refund_address"), // for crypto orders (stablecoin)
    // TODO (L17): migrate status to pgEnum for type safety
    status: text("status").notNull(), // "requested" | "approved" | "refunded" | "rejected"
    updatedAt: timestamp("updated_at").notNull(),
  },
  (t) => [
    index("refund_request_order_id_idx").on(t.orderId),
    index("refund_request_status_idx").on(t.status),
    index("refund_request_created_at_idx").on(t.createdAt),
  ],
);
