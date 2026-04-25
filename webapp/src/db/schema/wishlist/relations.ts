import { relations } from "drizzle-orm";

import { productsTable } from "../orders/tables";
import { userTable } from "../users/tables";
import { wishlistTable } from "./tables";

export const wishlistRelations = relations(wishlistTable, ({ one }) => ({
  product: one(productsTable, {
    fields: [wishlistTable.productId],
    references: [productsTable.id],
  }),
  user: one(userTable, {
    fields: [wishlistTable.userId],
    references: [userTable.id],
  }),
}));
