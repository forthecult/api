import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/**
 * Tracks eSIM purchases made through our platform.
 * Maps our users to eSIM Card reseller API resources.
 */
export const esimOrdersTable = pgTable(
  "esim_order",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),

    // eSIM Card API identifiers
    esimId: text("esim_id"), // UUID from eSIM Card API (sim.id)
    iccid: text("iccid"), // eSIM ICCID
    esimOrderId: integer("esim_order_id"), // order ID from async purchase

    // Package info (snapshot at purchase time)
    packageId: text("package_id").notNull(), // UUID of the package purchased
    packageName: text("package_name").notNull(),
    packageType: text("package_type").notNull(), // "DATA-ONLY" | "DATA-VOICE-SMS"
    dataQuantity: integer("data_quantity").notNull(),
    dataUnit: text("data_unit").notNull(), // "GB" | "MB"
    validityDays: integer("validity_days").notNull(),
    countryName: text("country_name"), // Display: country or region name

    // Pricing
    costCents: integer("cost_cents").notNull(), // What we paid (reseller cost in cents)
    priceCents: integer("price_cents").notNull(), // What user paid (with markup)
    currency: text("currency").notNull().default("USD"),

    // Payment
    paymentMethod: text("payment_method").notNull(), // "stripe" | "solana_pay" | etc.
    paymentStatus: text("payment_status").notNull().default("pending"), // "pending" | "paid" | "failed" | "refunded"
    stripePaymentIntentId: text("stripe_payment_intent_id"),

    // eSIM status
    status: text("status").notNull().default("pending"), // "pending" | "processing" | "active" | "expired" | "failed"
    activationLink: text("activation_link"), // universal_link for eSIM setup

    // Timestamps
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    activatedAt: timestamp("activated_at"),
    expiresAt: timestamp("expires_at"),
  },
  (t) => [
    index("esim_order_user_id_idx").on(t.userId),
    index("esim_order_status_idx").on(t.status),
    index("esim_order_esim_id_idx").on(t.esimId),
  ],
);
