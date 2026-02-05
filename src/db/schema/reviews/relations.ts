import { relations } from "drizzle-orm";

import { productsTable } from "../orders/tables";
import { userTable } from "../users/tables";
import { productReviewsTable } from "./tables";

export const productReviewRelations = relations(
  productReviewsTable,
  ({ one }) => ({
    product: one(productsTable, {
      fields: [productReviewsTable.productId],
      references: [productsTable.id],
    }),
    user: one(userTable, {
      fields: [productReviewsTable.userId],
      references: [userTable.id],
    }),
  }),
);
