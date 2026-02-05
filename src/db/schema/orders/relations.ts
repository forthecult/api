import { relations } from "drizzle-orm";

import { affiliateTable } from "../affiliates/tables";
import { productCategoriesTable } from "../categories/tables";
import { productReviewsTable } from "../reviews/tables";
import { shippingOptionsTable } from "../shipping/tables";
import { wishlistTable } from "../wishlist/tables";
import {
  orderItemsTable,
  ordersTable,
  productAvailableCountryTable,
  productImagesTable,
  productsTable,
  productTagsTable,
  productTokenGateTable,
  productVariantsTable,
} from "./tables";
import { userTable } from "../users/tables";

export const productRelations = relations(productsTable, ({ many }) => ({
  productCategories: many(productCategoriesTable),
  productImages: many(productImagesTable),
  productReviews: many(productReviewsTable),
  productTags: many(productTagsTable),
  productVariants: many(productVariantsTable),
  productAvailableCountries: many(productAvailableCountryTable),
  tokenGates: many(productTokenGateTable),
  wishlist: many(wishlistTable),
}));

export const productTokenGateRelations = relations(
  productTokenGateTable,
  ({ one }) => ({
    product: one(productsTable, {
      fields: [productTokenGateTable.productId],
      references: [productsTable.id],
    }),
  }),
);

export const productAvailableCountryRelations = relations(
  productAvailableCountryTable,
  ({ one }) => ({
    product: one(productsTable, {
      fields: [productAvailableCountryTable.productId],
      references: [productsTable.id],
    }),
  }),
);

export const productImageRelations = relations(
  productImagesTable,
  ({ one }) => ({
    product: one(productsTable, {
      fields: [productImagesTable.productId],
      references: [productsTable.id],
    }),
  }),
);

export const productTagRelations = relations(productTagsTable, ({ one }) => ({
  product: one(productsTable, {
    fields: [productTagsTable.productId],
    references: [productsTable.id],
  }),
}));

export const productVariantRelations = relations(
  productVariantsTable,
  ({ one, many }) => ({
    product: one(productsTable, {
      fields: [productVariantsTable.productId],
      references: [productsTable.id],
    }),
    orderItems: many(orderItemsTable),
  }),
);

export const orderItemRelations = relations(orderItemsTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [orderItemsTable.orderId],
    references: [ordersTable.id],
  }),
  product: one(productsTable, {
    fields: [orderItemsTable.productId],
    references: [productsTable.id],
  }),
  productVariant: one(productVariantsTable, {
    fields: [orderItemsTable.productVariantId],
    references: [productVariantsTable.id],
  }),
}));

export const orderRelations = relations(ordersTable, ({ one, many }) => ({
  items: many(orderItemsTable),
  affiliate: one(affiliateTable, {
    fields: [ordersTable.affiliateId],
    references: [affiliateTable.id],
  }),
  shippingOption: one(shippingOptionsTable, {
    fields: [ordersTable.shippingOptionId],
    references: [shippingOptionsTable.id],
  }),
  user: one(userTable, {
    fields: [ordersTable.userId],
    references: [userTable.id],
  }),
}));
