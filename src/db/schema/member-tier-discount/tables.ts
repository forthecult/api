import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { categoriesTable } from "../categories/tables";
import { productsTable } from "../orders/tables";

/**
 * Per-tier discount rules. Multiple rows per tier so discounts stack
 * (e.g. Tier 3: 20% off shipping + 15% off eSIM category).
 * Scope: shipping | order | category | product.
 * Empty categoryId/productId for "order" or "shipping"; set for category/product scopes.
 */
export const memberTierDiscountTable = pgTable("member_tier_discount", {
  /** When 1, scope is effectively "eSIMs" (cart items with productId like esim_*). Used with scope "product" and productId null. */
  appliesToEsim: integer("applies_to_esim"), // 0 | 1
  /** For scope = "category". Null = not used. */
  categoryId: text("category_id").references(() => categoriesTable.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").notNull(),
  discountType: text("discount_type").notNull(), // "percent" | "fixed"
  /** Percent 0–100 or cents. */
  discountValue: integer("discount_value").notNull(),
  id: text("id").primaryKey(),
  /** Admin-facing label (e.g. "Tier 3: 20% off shipping"). */
  label: text("label"),
  /** CULT member tier (1 = best, 4 = entry). */
  memberTier: integer("member_tier").notNull(),
  /** For scope = "product". Null = not used. When scope = "product" and this is null, applies to eSIM items (productId starting with "esim_"). */
  productId: text("product_id").references(() => productsTable.id, {
    onDelete: "cascade",
  }),
  /** What this discount applies to. */
  scope: text("scope").notNull(), // "shipping" | "order" | "category" | "product"
  updatedAt: timestamp("updated_at").notNull(),
});
