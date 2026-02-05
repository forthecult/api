import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { productsTable } from "../orders/tables";
import { userTable } from "../users/tables";

export const wishlistTable = pgTable(
  "wishlist",
  {
    createdAt: timestamp("created_at").notNull(),
    productId: text("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
);
