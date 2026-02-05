import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { brandTable } from "~/db/schema/brands/tables";

/** type: flat = one amount for order; per_item = amount × quantity; free = $0 when conditions match */
export const shippingOptionsTable = pgTable("shipping_option", {
  amountCents: integer("amount_cents"),
  /** When set, this option applies only to orders/items for this brand. */
  brandId: text("brand_id").references(() => brandTable.id, { onDelete: "set null" }),
  countryCode: text("country_code"),
  createdAt: timestamp("created_at").notNull(),
  /** Human-readable estimate from brand site, e.g. "2-7 business days". */
  estimatedDaysText: text("estimated_days_text"),
  id: text("id").primaryKey(),
  maxOrderCents: integer("max_order_cents"),
  maxQuantity: integer("max_quantity"),
  maxWeightGrams: integer("max_weight_grams"),
  minOrderCents: integer("min_order_cents"),
  minQuantity: integer("min_quantity"),
  minWeightGrams: integer("min_weight_grams"),
  name: text("name").notNull(),
  priority: integer("priority").notNull().default(0),
  /** URL where this option was scraped from (e.g. brand shipping page). */
  sourceUrl: text("source_url"),
  type: text("type").notNull(), // "flat" | "per_item" | "free"
  updatedAt: timestamp("updated_at").notNull(),
});
