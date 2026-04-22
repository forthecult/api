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
    createdAt: timestamp("created_at").notNull(),
    description: text("description"),
    featured: boolean("featured").notNull().default(false),
    /** Default Google Merchant category path for products assigned to this category (unless the product overrides it). */
    googleProductCategory: text("google_product_category"),
    id: text("id").primaryKey(),
    imageUrl: text("image_url"),
    level: integer("level").notNull().default(1),
    metaDescription: text("meta_description"),
    name: text("name").notNull(),
    parentId: text("parent_id"),
    seoOptimized: boolean("seo_optimized").notNull().default(false),
    slug: text("slug").unique(),
    title: text("title"),
    tokenGateContractAddress: text("token_gate_contract_address"),
    tokenGated: boolean("token_gated").notNull().default(false),
    tokenGateNetwork: text("token_gate_network"),
    tokenGateQuantity: integer("token_gate_quantity"),
    tokenGateType: text("token_gate_type"), // legacy single-gate
    updatedAt: timestamp("updated_at").notNull(),
    /** When false, category is hidden from the mega menu and public browsing. */
    visible: boolean("visible").notNull().default(true),
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
    categoryId: text("category_id")
      .notNull()
      .references(() => categoriesTable.id, { onDelete: "cascade" }),
    isMain: boolean("is_main").notNull().default(false),
    productId: text("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
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
  categoryId: text("category_id")
    .notNull()
    .references(() => categoriesTable.id, { onDelete: "cascade" }),
  contractAddress: text("contract_address"), // for custom tokens
  id: text("id").primaryKey(),
  network: text("network"), // solana | ethereum | base | etc. for custom tokens
  quantity: integer("quantity").notNull(), // min amount (manual quantity per token)
  tokenSymbol: text("token_symbol").notNull(), // e.g. CULT, PUMP, WHALE
});

/**
 * Perpetual auto-assign rules: when a product is created/imported, if it matches
 * a rule (e.g. title contains "1INCH"), it is automatically added to that category.
 */
export const categoryAutoAssignRuleTable = pgTable(
  "category_auto_assign_rule",
  {
    brand: text("brand"),
    categoryId: text("category_id")
      .notNull()
      .references(() => categoriesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull(),
    createdWithinDays: integer("created_within_days"),
    enabled: boolean("enabled").notNull().default(true),
    id: text("id").primaryKey(),
    /** Product must have at least one tag containing this (ilike). */
    tagContains: text("tag_contains"),
    titleContains: text("title_contains"),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (t) => [index("category_auto_assign_rule_category_id_idx").on(t.categoryId)],
);
