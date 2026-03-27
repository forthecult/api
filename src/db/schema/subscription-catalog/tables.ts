import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { productsTable } from "../orders/tables";
import { userTable } from "../users/tables";

/** Sellable subscription product or service (independent of physical `product` rows). */
export const subscriptionOfferTable = pgTable(
  "subscription_offer",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    name: text("name").notNull(),
    productId: text("product_id").references(() => productsTable.id, {
      onDelete: "set null",
    }),
    published: boolean("published").notNull().default(true),
    slug: text("slug").notNull().unique(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("subscription_offer_published_idx").on(t.published)],
);

/** Billing options for an offer (weekly / monthly / annual, prices, payment rails). */
export const subscriptionPlanTable = pgTable(
  "subscription_plan",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    cryptoProductId: text("crypto_product_id").references(() => productsTable.id, {
      onDelete: "set null",
    }),
    currency: text("currency").notNull().default("USD"),
    displayName: text("display_name"),
    id: text("id").primaryKey(),
    intervalCount: integer("interval_count").notNull().default(1),
    intervalUnit: text("interval_unit").notNull(),
    /** e.g. `{ "membershipTier": 1, "billingInterval": "monthly" }` for membership plans. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    offerId: text("offer_id")
      .notNull()
      .references(() => subscriptionOfferTable.id, { onDelete: "cascade" }),
    payCryptoManual: boolean("pay_crypto_manual").notNull().default(false),
    payPaypal: boolean("pay_paypal").notNull().default(false),
    payStripe: boolean("pay_stripe").notNull().default(false),
    paypalPlanId: text("paypal_plan_id"),
    priceCents: integer("price_cents").notNull(),
    published: boolean("published").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    stripePriceId: text("stripe_price_id"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("subscription_plan_offer_idx").on(t.offerId)],
);

/** Active subscription for a user (Stripe, PayPal, or manual crypto renewals). */
export const subscriptionInstanceTable = pgTable(
  "subscription_instance",
  {
    billingProvider: text("billing_provider").notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currentPeriodEnd: timestamp("current_period_end").notNull(),
    currentPeriodStart: timestamp("current_period_start").notNull(),
    id: text("id").primaryKey(),
    lastOrderId: text("last_order_id"),
    offerId: text("offer_id")
      .notNull()
      .references(() => subscriptionOfferTable.id, { onDelete: "restrict" }),
    paypalSubscriptionId: text("paypal_subscription_id").unique(),
    planId: text("plan_id")
      .notNull()
      .references(() => subscriptionPlanTable.id, { onDelete: "restrict" }),
    status: text("status").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripePriceId: text("stripe_price_id"),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("subscription_instance_user_idx").on(t.userId),
    index("subscription_instance_plan_idx").on(t.planId),
  ],
);
