import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { productsTable } from "../orders/tables";
import { userTable } from "../users/tables";

/**
 * Product reviews table.
 *
 * Reviews can exist independently of products (productId is nullable).
 * This allows:
 * - Importing legacy reviews before products are created
 * - Keeping reviews visible after products are archived/deleted
 * - Displaying reviews on homepage/testimonials without requiring active products
 *
 * productSlug stores the original product handle for matching and display.
 * productName stores a snapshot of the product name for display when product is deleted.
 */
export const productReviewsTable = pgTable(
  "product_review",
  {
    author: text("author"), // first name only (e.g. from imported reviews)
    comment: text("comment").notNull(), // review body
    createdAt: timestamp("created_at").notNull(),
    // Reviewer info
    customerName: text("customer_name").notNull(),

    id: text("id").primaryKey(),
    location: text("location"),
    // Product reference (nullable - reviews persist even if product deleted)
    productId: text("product_id").references(() => productsTable.id, {
      onDelete: "set null",
    }),

    // Snapshot of product name for display when product is deleted
    productName: text("product_name"),
    // Product slug/handle for matching and display (persists after product deletion)
    productSlug: text("product_slug"),
    // Review content
    rating: integer("rating").notNull(), // 1–5
    showName: boolean("show_name").notNull().default(true), // if false, display anonymous label

    title: text("title"), // review title

    updatedAt: timestamp("updated_at").notNull(),
    // Optional user account link
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    // Visibility and timestamps
    visible: boolean("visible").notNull().default(true),
  },
  (t) => [
    // Index for product lookups (reviews for a specific product)
    index("product_review_product_id_idx").on(t.productId),
    // Index for slug lookups (matching reviews to products by slug)
    index("product_review_product_slug_idx").on(t.productSlug),
    // Index for visible reviews sorted by date (homepage, testimonials)
    index("product_review_visible_created_idx").on(t.visible, t.createdAt),
    // M43: Enforce rating is between 1 and 5
    check("rating_range", sql`${t.rating} >= 1 AND ${t.rating} <= 5`),
  ],
);
