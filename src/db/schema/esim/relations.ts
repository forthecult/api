import { relations } from "drizzle-orm";

import { userTable } from "../users/tables";

import { esimOrdersTable } from "./tables";

export const esimOrdersRelations = relations(esimOrdersTable, ({ one }) => ({
  user: one(userTable, {
    fields: [esimOrdersTable.userId],
    references: [userTable.id],
  }),
}));
