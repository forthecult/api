import {
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/** Affiliate account. status: pending (awaiting approval), approved, rejected, suspended. */
export const affiliateTable = pgTable("affiliate", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => userTable.id, { onDelete: "set null" }),
  code: text("code").notNull().unique(),
  status: text("status").notNull().default("pending"), // "pending" | "approved" | "rejected" | "suspended"
  commissionType: text("commission_type").notNull().default("percent"), // "percent" | "fixed"
  commissionValue: integer("commission_value").notNull().default(10), // percent 0-100 or cents
  customerDiscountType: text("customer_discount_type"), // "percent" | "fixed" | null
  customerDiscountValue: integer("customer_discount_value"), // nullable
  applicationNote: text("application_note"),
  adminNote: text("admin_note"),
  payoutMethod: text("payout_method"), // "paypal" | "bitcoin" | "stablecoin" | "cult"
  payoutAddress: text("payout_address"),
  totalEarnedCents: integer("total_earned_cents").notNull().default(0),
  totalPaidCents: integer("total_paid_cents").notNull().default(0),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

/** Tracks affiliate link clicks/visits. orderId is set when visitor converts (no FK to avoid circular deps). */
export const affiliateAttributionTable = pgTable("affiliate_attribution", {
  id: text("id").primaryKey(),
  affiliateId: text("affiliate_id")
    .notNull()
    .references(() => affiliateTable.id, { onDelete: "cascade" }),
  visitorId: text("visitor_id").notNull(),
  landingPage: text("landing_page"),
  referrer: text("referrer"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull(),
  convertedAt: timestamp("converted_at"),
  orderId: text("order_id"),
});
