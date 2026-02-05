import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/** Printful-compatible address fields. */
export const addressesTable = pgTable("address", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),

  // Printful-compatible names
  address1: text("address1").notNull(),
  address2: text("address2"),
  city: text("city").notNull(),
  stateCode: text("state_code"), // 2-letter code (e.g. CA, NY)
  countryCode: text("country_code").notNull(), // ISO 2-letter (e.g. US, CA)
  zip: text("zip").notNull(),
  phone: text("phone"), // Printful requires phone for shipping

  label: text("label"), // "Home", "Work", etc.
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});
