import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { productsTable } from "../orders/tables";

export const categoriesTable = pgTable(
  "category",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").unique(),
    title: text("title"),
    metaDescription: text("meta_description"),
    description: text("description"),
    imageUrl: text("image_url"),
    level: integer("level").notNull().default(1),
    featured: boolean("featured").notNull().default(false),
    seoOptimized: boolean("seo_optimized").notNull().default(false),
    parentId: text("parent_id"),
    tokenGated: boolean("token_gated").notNull().default(false),
    tokenGateType: text("token_gate_type"), // legacy single-gate
    tokenGateQuantity: integer("token_gate_quantity"),
    tokenGateNetwork: text("token_gate_network"),
    tokenGateContractAddress: text("token_gate_contract_address"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (t) => [
    // L15: ON DELETE set null so child categories survive parent removal
    foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: "category_parent_fk",
    }).onDelete("set null"),
  ],
);

/** junction: product can have multiple categories; one is main for URL/SEO (isMain = true). */
export const productCategoriesTable = pgTable(
  "product_category",
  {
    productId: text("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categoriesTable.id, { onDelete: "cascade" }),
    isMain: boolean("is_main").notNull().default(false),
    /** Admin-controlled display order within a category. Lower = first. NULL = unordered (sorted after explicit entries). */
    sortOrder: integer("sort_order"),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.categoryId] }),
    // Index for faster category->product lookups (product listing by category)
    index("product_category_category_id_idx").on(t.categoryId),
    // Index for finding main category of a product
    index("product_category_product_id_is_main_idx").on(t.productId, t.isMain),
  ],
);

/** Multiple token gates per category: access if user holds >= quantity of ANY token (OR). */
export const categoryTokenGateTable = pgTable("category_token_gate", {
  id: text("id").primaryKey(),
  categoryId: text("category_id")
    .notNull()
    .references(() => categoriesTable.id, { onDelete: "cascade" }),
  tokenSymbol: text("token_symbol").notNull(), // e.g. CULT, PUMP, WHALE
  quantity: integer("quantity").notNull(), // min amount (manual quantity per token)
  network: text("network"), // solana | ethereum | base | etc. for custom tokens
  contractAddress: text("contract_address"), // for custom tokens
});

/**
 * Perpetual auto-assign rules: when a product is created/imported, if it matches
 * a rule (e.g. title contains "1INCH"), it is automatically added to that category.
 */
export const categoryAutoAssignRuleTable = pgTable(
  "category_auto_assign_rule",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categoriesTable.id, { onDelete: "cascade" }),
    titleContains: text("title_contains"),
    createdWithinDays: integer("created_within_days"),
    brand: text("brand"),
    /** Product must have at least one tag containing this (ilike). */
    tagContains: text("tag_contains"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (t) => [
    index("category_auto_assign_rule_category_id_idx").on(t.categoryId),
  ],
);
