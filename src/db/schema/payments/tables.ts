import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/** Which payment methods are enabled on the storefront. Admin can toggle; disabled methods are hidden in checkout and product pages. */
export const paymentMethodSettingTable = pgTable("payment_method_setting", {
  createdAt: timestamp("created_at").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  /** For methods with multiple networks (e.g. USDC, USDT): enabled network keys. Null or empty = all supported networks. */
  enabledNetworks: jsonb("enabled_networks").$type<null | string[]>(),
  label: text("label").notNull(),
  methodKey: text("method_key").primaryKey(),
  updatedAt: timestamp("updated_at").notNull(),
});

/** Maps app users to Stripe Customer IDs for subscription billing. */
export const stripeCustomerTable = pgTable("stripe_customer", {
  userId: text("user_id")
    .notNull()
    .primaryKey()
    .references(() => userTable.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
