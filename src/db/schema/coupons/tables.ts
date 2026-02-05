import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { categoriesTable } from "../categories/tables";
import { productsTable } from "../orders/tables";

/**
 * Discount (coupon). method: "automatic" (applied automatically) or "code" (customer enters code).
 * discountKind: "amount_off_products" | "amount_off_order" | "buy_x_get_y" | "free_shipping".
 * appliesTo: legacy "subtotal" | "shipping" (derived from discountKind for compatibility).
 * Empty categories/products = all; otherwise restricted. For "code", code is required; for "automatic", code is internal (e.g. AUTO-{id}).
 */
export const couponsTable = pgTable("coupon", {
  id: text("id").primaryKey(),
  method: text("method").notNull().default("code"), // "automatic" | "code"
  code: text("code").notNull().unique(), // e.g. SAVE20 (stored uppercase); for automatic, e.g. AUTO-{id}
  dateStart: timestamp("date_start"), // null = no start
  dateEnd: timestamp("date_end"), // null = no end
  discountKind: text("discount_kind").notNull().default("amount_off_order"), // "amount_off_products" | "amount_off_order" | "buy_x_get_y" | "free_shipping"
  discountType: text("discount_type").notNull(), // "percent" | "fixed"
  discountValue: integer("discount_value").notNull(), // percent 0-100 or cents
  appliesTo: text("applies_to").notNull(), // "subtotal" | "shipping" (legacy)
  // Buy X get Y: buy this many, get getQuantity at getDiscountType/getDiscountValue
  buyQuantity: integer("buy_quantity"), // null = not buy_x_get_y
  getQuantity: integer("get_quantity"),
  getDiscountType: text("get_discount_type"), // "percent" | "fixed"
  getDiscountValue: integer("get_discount_value"), // percent or cents
  maxUses: integer("max_uses"), // total redemptions allowed; null = unlimited
  maxUsesPerCustomer: integer("max_uses_per_customer"), // null = unlimited
  maxUsesPerCustomerType: text("max_uses_per_customer_type"), // "account" | "phone" | "shipping_address"
  // Token-holder free shipping: when method is "automatic" and discountKind is "free_shipping",
  // if user has a linked wallet with balance >= min, they get free shipping
  tokenHolderChain: text("token_holder_chain"), // "solana" | "evm"
  tokenHolderTokenAddress: text("token_holder_token_address"), // mint (Solana) or contract (EVM)
  tokenHolderMinBalance: text("token_holder_min_balance"), // decimal string, e.g. "1"
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

/** Categories this coupon applies to; empty = all categories. */
export const couponCategoryTable = pgTable(
  "coupon_category",
  {
    couponId: text("coupon_id")
      .notNull()
      .references(() => couponsTable.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categoriesTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.couponId, t.categoryId] })],
);

/** Products this coupon applies to; empty = all products. */
export const couponProductTable = pgTable(
  "coupon_product",
  {
    couponId: text("coupon_id")
      .notNull()
      .references(() => couponsTable.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.couponId, t.productId] })],
);

/** Redemption record for usage limits and per-customer limits. */
export const couponRedemptionTable = pgTable("coupon_redemption", {
  id: text("id").primaryKey(),
  couponId: text("coupon_id")
    .notNull()
    .references(() => couponsTable.id, { onDelete: "cascade" }),
  orderId: text("order_id"), // optional link to order
  userId: text("user_id"), // for "account" limit
  phone: text("phone"), // for "phone" limit
  shippingAddressHash: text("shipping_address_hash"), // for "shipping_address" limit
  createdAt: timestamp("created_at").notNull(),
});
