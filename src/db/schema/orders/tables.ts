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

export const productsTable = pgTable("product", {
  barcode: text("barcode"),
  brand: text("brand"),
  /** Blank product model (e.g. "3001") for size chart lookup. */
  model: text("model"),
  compareAtPriceCents: integer("compare_at_price_cents"),
  continueSellingWhenOutOfStock: boolean("continue_selling_when_out_of_stock")
    .notNull()
    .default(false),
  costPerItemCents: integer("cost_per_item_cents"),
  countryOfOrigin: text("country_of_origin"),
  createdAt: timestamp("created_at").notNull(),
  description: text("description"),
  /** Bullet-point features (JSON array of strings). Shown on product page; details go in description. */
  featuresJson: text("features_json"),
  externalId: text("external_id"), // printful: catalog_product_id / printify: blueprint_id
  hasVariants: boolean("has_variants").notNull().default(false),
  hsCode: text("hs_code"),
  id: text("id").primaryKey(),
  imageUrl: text("image_url"),
  /** SEO: alt text for main product image */
  mainImageAlt: text("main_image_alt"),
  /** SEO: title for main product image */
  mainImageTitle: text("main_image_title"),
  metaDescription: text("meta_description"),
  name: text("name").notNull(),
  optionDefinitionsJson: text("option_definitions_json"), // [{ name, values: string[] }]
  pageTitle: text("page_title"),
  /** Product page layout: "default" (standard PDP) or "long-form" (hero, sections, specs, FAQ). */
  pageLayout: text("page_layout").default("default"),
  physicalProduct: boolean("physical_product").notNull().default(true),
  priceCents: integer("price_cents").notNull(),
  published: boolean("published").notNull().default(true),
  /** When true, product is still published but only reachable by direct slug URL; excluded from category and product listings. */
  hidden: boolean("hidden").notNull().default(false),
  // Ships from: full address (when set) or composed from city/region/postal/country for display and shipping-time estimates
  shipsFromDisplay: text("ships_from_display"), // optional freeform full address
  shipsFromCountry: text("ships_from_country"), // ISO 2-letter or country name
  shipsFromRegion: text("ships_from_region"), // state / province / region
  shipsFromCity: text("ships_from_city"),
  shipsFromPostalCode: text("ships_from_postal_code"),
  // Estimated delivery: fulfillment (handling) and transit days from vendor or manual
  handlingDaysMin: integer("handling_days_min"), // e.g. from Printify shipping.json
  handlingDaysMax: integer("handling_days_max"),
  transitDaysMin: integer("transit_days_min"), // optional; fallback in UI if null
  transitDaysMax: integer("transit_days_max"),
  quantity: integer("quantity"), // simple product inventory when trackQuantity
  sizeGuideJson: text("size_guide_json"),
  sku: text("sku"),
  slug: text("slug").unique(),
  source: text("source").notNull(), // "manual" | "printful" | "printify"
  stripePriceId: text("stripe_price_id"),
  tokenGated: boolean("token_gated").notNull().default(false),
  tokenGateType: text("token_gate_type"), // "cult_default" | "cult_custom" | "other"
  tokenGateQuantity: integer("token_gate_quantity"),
  tokenGateNetwork: text("token_gate_network"), // solana | ethereum | base | arbitrum | bnb | polygon | avalanche
  tokenGateContractAddress: text("token_gate_contract_address"),
  trackQuantity: boolean("track_quantity").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull(),
  vendor: text("vendor"),
  weightGrams: integer("weight_grams"),
  weightUnit: text("weight_unit"), // "kg" | "lb"
  /** Product type from POD catalog (e.g. T-SHIRT, HOODIE, MUG). Useful for filtering and SEO. */
  productType: text("product_type"),
  /** True when the underlying catalog product is discontinued by the manufacturer. Product should be hidden from storefront. */
  isDiscontinued: boolean("is_discontinued").notNull().default(false),

  // Printful Sync Product – stores the sync_product_id from Printful for bidirectional sync
  // BIGINT: Printful IDs can exceed 32-bit INTEGER max (2,147,483,647)
  printfulSyncProductId: bigint("printful_sync_product_id", { mode: "number" }).unique(),
  // Printify Product ID – stores the product ID from Printify for bidirectional sync
  printifyProductId: text("printify_product_id").unique(),
  // Printify print provider ID – required for Printify shipping calculation (catalog shipping profiles)
  printifyPrintProviderId: integer("printify_print_provider_id"),
  // Printify shipping eligibility flags — synced from Printify product data
  /** Whether the product is eligible for Printify Express shipping. */
  printifyExpressEligible: boolean("printify_express_eligible").notNull().default(false),
  /** Whether Printify Express is enabled for this product. */
  printifyExpressEnabled: boolean("printify_express_enabled").notNull().default(false),
  /** Whether the product is eligible for economy shipping. */
  printifyEconomyEligible: boolean("printify_economy_eligible").notNull().default(false),
  /** Whether economy shipping is enabled for this product. */
  printifyEconomyEnabled: boolean("printify_economy_enabled").notNull().default(false),
  /** GPSR (EU General Product Safety Regulation) compliance data — JSON from Printify /gpsr.json. */
  gpsrJson: jsonb("gpsr_json"),
  // Last sync timestamp – when the product was last synced with the vendor
  lastSyncedAt: timestamp("last_synced_at"),
  // POD AI/creator: product created via POD bulk or AI flow
  aiGenerated: boolean("ai_generated").default(false),
  // Original design image URL (for POD-created products)
  sourceImageUrl: text("source_image_url"),
}, (t) => [
  // M3: Composite index for filtering published & non-hidden products
  index("product_published_hidden_idx").on(t.published, t.hidden),
  // M4: Index for product name search (btree helps prefix ILIKE; for full trigram support use a GIN index via raw migration)
  index("product_name_idx").on(t.name),
]);

export const productVariantsTable = pgTable(
  "product_variant",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    externalId: text("external_id"), // printful: catalog_variant_id / printify: variant_id
    size: text("size"),
    color: text("color"),
    /** Gender/style option (e.g. Men's / Women's for Earth Runners). Used when product has 3 option dimensions. */
    gender: text("gender"),
    colorCode: text("color_code"),
    /** Secondary color code (e.g. for two-tone products). From Printful catalog variant color_code2. */
    colorCode2: text("color_code2"),
    sku: text("sku"),
    /** Display label (e.g. Printful sync variant "name": "Product / Color / Size") */
    label: text("label"),
    stockQuantity: integer("stock_quantity"),
    priceCents: integer("price_cents").notNull(),
    weightGrams: integer("weight_grams"),
    imageUrl: text("image_url"),
    /** SEO: alt text for variant image */
    imageAlt: text("image_alt"),
    /** SEO: title for variant image */
    imageTitle: text("image_title"),
    /** Printful: "in_stock" | "out_of_stock" | etc. Synced on product_updated. */
    availabilityStatus: text("availability_status"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),

    // Printful Sync Variant ID – stores the sync_variant_id from Printful for bidirectional sync
    // BIGINT: Printful IDs can exceed 32-bit INTEGER max (2,147,483,647)
    printfulSyncVariantId: bigint("printful_sync_variant_id", { mode: "number" }),
    // Printify Variant ID – stores the variant ID from Printify for bidirectional sync
    printifyVariantId: text("printify_variant_id"),
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
    id: text("id").primaryKey(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    customerNote: text("customer_note"),
    discountPercent: integer("discount_percent").notNull().default(0),
    email: text("email").notNull(),
    // TODO (L17): migrate fulfillmentStatus to pgEnum for type safety
    fulfillmentStatus: text("fulfillment_status"), // "unfulfilled" | "on_hold" | "partially_fulfilled" | "fulfilled"
    internalNotes: text("internal_notes"),
    // TODO (L17): migrate paymentStatus to pgEnum for type safety
    paymentStatus: text("payment_status"), // "pending" | "paid" | "refund_pending" | "refunded" | "cancelled"
    // TODO (L17): migrate status to pgEnum for type safety
    status: text("status").notNull(), // legacy: "pending" | "paid" | "fulfilled" | "cancelled" | "refund_pending" | "refunded"
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    shippingFeeCents: integer("shipping_fee_cents").notNull().default(0),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
    }),

    // Telegram Mini App — for orders placed from Telegram
    telegramUserId: text("telegram_user_id"),
    telegramUsername: text("telegram_username"),
    telegramFirstName: text("telegram_first_name"),

    // Shipping — Printful-compatible names
    shippingName: text("shipping_name"),
    shippingAddress1: text("shipping_address1"),
    shippingAddress2: text("shipping_address2"),
    shippingCity: text("shipping_city"),
    shippingStateCode: text("shipping_state_code"), // 2-letter
    shippingCountryCode: text("shipping_country_code"), // ISO 2-letter
    shippingZip: text("shipping_zip"),
    shippingPhone: text("shipping_phone"), // Printful requires phone
    // L16: ON DELETE set null so orders survive shipping option removal
    shippingOptionId: text("shipping_option_id").references(
      () => shippingOptionsTable.id,
      { onDelete: "set null" },
    ),
    shippingMethod: text("shipping_method"), // "standard" | "express" | Printful shipping ID

    // Payment — Stripe
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),

    // Payment — Solana / crypto
    solanaPayDepositAddress: text("solana_pay_deposit_address").unique(),
    solanaPayReference: text("solana_pay_reference").unique(),
    paymentMethod: text("payment_method").notNull().default("stripe"), // "stripe" | "solana_pay" | "eth_pay" | "btcpay" | "ton_pay" | "paypal" | "crypto"
    // Payment — BTCPay Server (Bitcoin, Dogecoin, Monero via Bitpay-compatible API)
    btcpayInvoiceId: text("btcpay_invoice_id"),
    btcpayInvoiceUrl: text("btcpay_invoice_url"),
    cryptoCurrencyNetwork: text("crypto_currency_network"), // "Ethereum" | "Solana" | "Base" | etc.
    cryptoCurrency: text("crypto_currency"), // "SOL" | "ETH" | "USDC" | null
    cryptoAmount: text("crypto_amount"), // String for precision
    cryptoTxHash: text("crypto_tx_hash"),
    payerWalletAddress: text("payer_wallet_address"),
    chainId: integer("chain_id"), // EVM chain ID (1=ETH, 8453=Base)

    printfulOrderId: text("printful_order_id").unique(),
    printifyOrderId: text("printify_order_id").unique(),

    // --- Shipment tracking (all providers: Printful, Printify, manual) ---
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    trackingCarrier: text("tracking_carrier"),
    shippedAt: timestamp("shipped_at"),
    deliveredAt: timestamp("delivered_at"),
    /** Estimated delivery window – earliest date (ISO date string, e.g. "2025-06-15"). */
    estimatedDeliveryFrom: text("estimated_delivery_from"),
    /** Estimated delivery window – latest date (ISO date string, e.g. "2025-06-20"). */
    estimatedDeliveryTo: text("estimated_delivery_to"),
    /** Shipment tracking events from fulfiller (JSON array of { triggered_at, description }). */
    trackingEventsJson: jsonb("tracking_events_json"),

    // --- Printful fulfillment costs (admin-only, wholesale cost to us) ---
    /** Printful total cost in cents (USD). Admin-only; not shown to customers. */
    printfulCostTotalCents: integer("printful_cost_total_cents"),
    /** Printful shipping cost in cents (USD). */
    printfulCostShippingCents: integer("printful_cost_shipping_cents"),
    /** Printful tax/VAT cost in cents (USD). */
    printfulCostTaxCents: integer("printful_cost_tax_cents"),

    // --- Printify fulfillment costs (admin-only, wholesale cost to us) ---
    /** Printify total price in cents (USD). Admin-only; not shown to customers. */
    printifyCostTotalCents: integer("printify_cost_total_cents"),
    /** Printify shipping cost in cents (USD). */
    printifyCostShippingCents: integer("printify_cost_shipping_cents"),
    /** Printify tax cost in cents (USD). */
    printifyCostTaxCents: integer("printify_cost_tax_cents"),

    // Affiliate attribution
    affiliateId: text("affiliate_id").references(() => affiliateTable.id, {
      onDelete: "set null",
    }),
    affiliateCode: text("affiliate_code"),
    affiliateCommissionCents: integer("affiliate_commission_cents"),
    affiliateDiscountCents: integer("affiliate_discount_cents"),

    // Moltbook agent identity (when order placed with X-Moltbook-Identity)
    moltbookAgentId: text("moltbook_agent_id"),
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
export const productImagesTable = pgTable("product_image", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => productsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  alt: text("alt"),
  title: text("title"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [
  // M7: Index for looking up images by product
  index("product_image_product_id_idx").on(t.productId),
]);

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
    productId: text("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    countryCode: text("country_code").notNull(), // e.g. US, GB, DE
  },
  (t) => [primaryKey({ columns: [t.productId, t.countryCode] })],
);

/** Multiple token gates per product: access if user holds >= quantity of ANY token (OR). */
export const productTokenGateTable = pgTable("product_token_gate", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => productsTable.id, { onDelete: "cascade" }),
  tokenSymbol: text("token_symbol").notNull(), // e.g. CULT, PUMP, WHALE
  quantity: integer("quantity").notNull(),
  network: text("network"),
  contractAddress: text("contract_address"),
}, (t) => [
  // M7: Index for looking up token gates by product
  index("product_token_gate_product_id_idx").on(t.productId),
]);

/** One-off custom prints (not synced to store). Tracked for ordering only. */
export const customPrintsTable = pgTable("custom_print", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(), // "printify" | "printful"
  externalProductId: text("external_product_id").notNull(),
  blueprintId: text("blueprint_id"),
  blueprintTitle: text("blueprint_title"),
  imageUrl: text("image_url"),
  userId: text("user_id").references(() => userTable.id, { onDelete: "set null" }),
  // TODO (L17): migrate status to pgEnum for type safety
  status: text("status").notNull(), // "created" | "ordered" | "fulfilled"
  orderId: text("order_id").references(() => ordersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull(),
  expiresAt: timestamp("expires_at"), // optional: auto-cleanup if not ordered
});

/** Customer refund requests. Status: requested → approved/refunded/rejected. */
export const refundRequestsTable = pgTable(
  "refund_request",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    // TODO (L17): migrate status to pgEnum for type safety
    status: text("status").notNull(), // "requested" | "approved" | "refunded" | "rejected"
    refundAddress: text("refund_address"), // for crypto orders (stablecoin)
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (t) => [
    index("refund_request_order_id_idx").on(t.orderId),
    index("refund_request_status_idx").on(t.status),
    index("refund_request_created_at_idx").on(t.createdAt),
  ],
);
