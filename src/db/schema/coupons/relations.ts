import { relations } from "drizzle-orm";

import { categoriesTable } from "../categories/tables";
import { productsTable } from "../orders/tables";

import {
  couponCategoryTable,
  couponProductTable,
  couponsTable,
} from "./tables";

export const couponsRelations = relations(couponsTable, ({ many }) => ({
  categories: many(couponCategoryTable),
  products: many(couponProductTable),
}));

export const couponCategoryRelations = relations(
  couponCategoryTable,
  ({ one }) => ({
    coupon: one(couponsTable, {
      fields: [couponCategoryTable.couponId],
      references: [couponsTable.id],
    }),
    category: one(categoriesTable, {
      fields: [couponCategoryTable.categoryId],
      references: [categoriesTable.id],
    }),
  }),
);

export const couponProductRelations = relations(
  couponProductTable,
  ({ one }) => ({
    coupon: one(couponsTable, {
      fields: [couponProductTable.couponId],
      references: [couponsTable.id],
    }),
    product: one(productsTable, {
      fields: [couponProductTable.productId],
      references: [productsTable.id],
    }),
  }),
);
