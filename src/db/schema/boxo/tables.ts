import { decimal, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/** One-time auth codes for Boxo Connect OAuth flow. Frontend gets a code for the current session; Boxo exchanges it for an access token. */
export const boxoAuthCodeTable = pgTable("boxo_auth_code", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

/** Access tokens issued to Boxo for get-user-data calls. Optionally store refresh_token for refresh flow. */
export const boxoTokenTable = pgTable("boxo_token", {
  accessToken: text("access_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  refreshToken: text("refresh_token").unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

/** Boxo Payments: order payments created by miniapps; we return order_payment_id and later report status. */
export const boxoOrderPaymentTable = pgTable("boxo_order_payment", {
  id: text("id").primaryKey(), // order_payment_id returned to Boxo
  appId: text("app_id").notNull(),
  clientId: text("client_id").notNull(),
  userId: text("user_id").notNull(), // host app user reference
  miniappOrderId: text("miniapp_order_id"),
  amount: decimal("amount", { precision: 20, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull().default("in_process"), // in_process | paid | cancelled | failed
  paymentFailReason: text("payment_fail_reason"),
  orderPayload: jsonb("order_payload").$type<Record<string, unknown>>(), // full order from Boxo for reference
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});
