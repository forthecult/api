import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/** Internal admin-only comments on a customer record. */
export const customerCommentsTable = pgTable(
  "customer_comment",
  {
    authorId: text("author_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull(),
    customerId: text("customer_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
  },
  (t) => [
    // M7: Index for looking up comments by customer
    index("customer_comment_customer_id_idx").on(t.customerId),
  ],
);
