import { relations } from "drizzle-orm";

import { productsTable } from "../orders/tables";
import {
  categoriesTable,
  categoryTokenGateTable,
  productCategoriesTable,
} from "./tables";

export const categoriesRelations = relations(
  categoriesTable,
  ({ many, one }) => ({
    children: many(categoriesTable, { relationName: "categoryParent" }),
    parent: one(categoriesTable, {
      fields: [categoriesTable.parentId],
      references: [categoriesTable.id],
      relationName: "categoryParent",
    }),
    productCategories: many(productCategoriesTable),
    tokenGates: many(categoryTokenGateTable),
  }),
);

export const categoryTokenGateRelations = relations(
  categoryTokenGateTable,
  ({ one }) => ({
    category: one(categoriesTable, {
      fields: [categoryTokenGateTable.categoryId],
      references: [categoriesTable.id],
    }),
  }),
);

export const productCategoriesRelations = relations(
  productCategoriesTable,
  ({ one }) => ({
    category: one(categoriesTable, {
      fields: [productCategoriesTable.categoryId],
      references: [categoriesTable.id],
    }),
    product: one(productsTable, {
      fields: [productCategoriesTable.productId],
      references: [productsTable.id],
    }),
  }),
);
