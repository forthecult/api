import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/** Affiliate account. status: pending (awaiting approval), approved, rejected, suspended. */
export const affiliateTable = pgTable("affiliate", {
  adminNote: text("admin_note"),
  applicationNote: text("application_note"),
  code: text("code").notNull().unique(),
  commissionType: text("commission_type").notNull().default("percent"), // "percent" | "fixed"
  commissionValue: integer("commission_value").notNull().default(10), // percent 0-100 or cents
  createdAt: timestamp("created_at").notNull(),
  customerDiscountType: text("customer_discount_type"), // "percent" | "fixed" | null
  customerDiscountValue: integer("customer_discount_value"), // nullable
  id: text("id").primaryKey(),
  payoutAddress: text("payout_address"),
  payoutMethod: text("payout_method"), // "paypal" | "bitcoin" | "stablecoin" | "cult"
  // TODO (L17): migrate status to pgEnum for type safety
  status: text("status").notNull().default("pending"), // "pending" | "approved" | "rejected" | "suspended"
  totalEarnedCents: integer("total_earned_cents").notNull().default(0),
  totalPaidCents: integer("total_paid_cents").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull(),
  userId: text("user_id").references(() => userTable.id, {
    onDelete: "set null",
  }),
});

/** Tracks affiliate link clicks/visits. orderId is set when visitor converts (no FK to avoid circular deps). */
export const affiliateAttributionTable = pgTable(
  "affiliate_attribution",
  {
    affiliateId: text("affiliate_id")
      .notNull()
      .references(() => affiliateTable.id, { onDelete: "cascade" }),
    convertedAt: timestamp("converted_at"),
    createdAt: timestamp("created_at").notNull(),
    id: text("id").primaryKey(),
    ipAddress: text("ip_address"),
    landingPage: text("landing_page"),
    orderId: text("order_id"),
    referrer: text("referrer"),
    visitorId: text("visitor_id").notNull(),
  },
  (t) => [
    // M7: Index for looking up attributions by affiliate
    index("affiliate_attr_affiliate_id_idx").on(t.affiliateId),
  ],
);
