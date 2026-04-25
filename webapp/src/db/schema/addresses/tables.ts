import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/** Printful-compatible address fields. */
export const addressesTable = pgTable(
  "address",
  {
    // Printful-compatible names
    address1: text("address1").notNull(),
    address2: text("address2"),

    city: text("city").notNull(),
    countryCode: text("country_code").notNull(), // ISO 2-letter (e.g. US, CA)
    createdAt: timestamp("created_at").notNull(),
    id: text("id").primaryKey(),
    isDefault: boolean("is_default").notNull().default(false),
    label: text("label"), // "Home", "Work", etc.
    phone: text("phone"), // Printful requires phone for shipping

    stateCode: text("state_code"), // 2-letter code (e.g. CA, NY)
    updatedAt: timestamp("updated_at").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    zip: text("zip").notNull(),
  },
  (t) => [
    // M7: Index for looking up addresses by user
    index("address_user_id_idx").on(t.userId),
  ],
);
