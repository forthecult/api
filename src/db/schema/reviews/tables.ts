import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { productsTable } from "../orders/tables";
import { userTable } from "../users/tables";

export const productReviewsTable = pgTable("product_review", {
  author: text("author"), // first name only (e.g. from imported reviews)
  comment: text("comment").notNull(), // review body
  createdAt: timestamp("created_at").notNull(),
  customerName: text("customer_name").notNull(),
  id: text("id").primaryKey(),
  location: text("location"),
  productId: text("product_id")
    .notNull()
    .references(() => productsTable.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(), // 1–5
  showName: boolean("show_name").notNull().default(true), // if false, display anonymous label instead of name
  title: text("title"), // review title
  updatedAt: timestamp("updated_at").notNull(),
  userId: text("user_id").references(() => userTable.id, {
    onDelete: "set null",
  }),
  visible: boolean("visible").notNull().default(true),
});
