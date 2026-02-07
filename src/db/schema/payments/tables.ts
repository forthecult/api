import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/** Which payment methods are enabled on the storefront. Admin can toggle; disabled methods are hidden in checkout and product pages. */
export const paymentMethodSettingTable = pgTable("payment_method_setting", {
  methodKey: text("method_key").primaryKey(),
  label: text("label").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const polarCustomerTable = pgTable("polar_customer", {
  createdAt: timestamp("created_at").notNull(),
  customerId: text("customer_id").notNull().unique(),
  id: text("id").primaryKey(),
  updatedAt: timestamp("updated_at").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
});

export const polarSubscriptionTable = pgTable("polar_subscription", {
  createdAt: timestamp("created_at").notNull(),
  customerId: text("customer_id").notNull(),
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  status: text("status").notNull(),
  subscriptionId: text("subscription_id").notNull().unique(),
  updatedAt: timestamp("updated_at").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
});
