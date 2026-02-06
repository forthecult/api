import {
  boolean,
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
    id: text("id").primaryKey(),
    // Product reference (nullable - reviews persist even if product deleted)
    productId: text("product_id").references(() => productsTable.id, {
      onDelete: "set null",
    }),
    // Product slug/handle for matching and display (persists after product deletion)
    productSlug: text("product_slug"),
    // Snapshot of product name for display when product is deleted
    productName: text("product_name"),

    // Review content
    rating: integer("rating").notNull(), // 1–5
    title: text("title"), // review title
    comment: text("comment").notNull(), // review body

    // Reviewer info
    customerName: text("customer_name").notNull(),
    author: text("author"), // first name only (e.g. from imported reviews)
    location: text("location"),
    showName: boolean("show_name").notNull().default(true), // if false, display anonymous label

    // Optional user account link
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
    }),

    // Visibility and timestamps
    visible: boolean("visible").notNull().default(true),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (t) => [
    // Index for product lookups (reviews for a specific product)
    index("product_review_product_id_idx").on(t.productId),
    // Index for slug lookups (matching reviews to products by slug)
    index("product_review_product_slug_idx").on(t.productSlug),
    // Index for visible reviews sorted by date (homepage, testimonials)
    index("product_review_visible_created_idx").on(t.visible, t.createdAt),
  ],
);
