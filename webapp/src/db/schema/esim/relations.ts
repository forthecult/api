import { relations } from "drizzle-orm";

import { ordersTable } from "../orders/tables";
import { userTable } from "../users/tables";
import { esimOrdersTable } from "./tables";

export const esimOrdersRelations = relations(esimOrdersTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [esimOrdersTable.orderId],
    references: [ordersTable.id],
  }),
  user: one(userTable, {
    fields: [esimOrdersTable.userId],
    references: [userTable.id],
  }),
}));
