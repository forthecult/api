import { relations } from "drizzle-orm";

import { categoriesTable } from "../categories/tables";
import { productsTable } from "../orders/tables";

import { memberTierDiscountTable } from "./tables";

export const memberTierDiscountRelations = relations(
  memberTierDiscountTable,
  ({ one }) => ({
    category: one(categoriesTable, {
      fields: [memberTierDiscountTable.categoryId],
      references: [categoriesTable.id],
    }),
    product: one(productsTable, {
      fields: [memberTierDiscountTable.productId],
      references: [productsTable.id],
    }),
  }),
);
