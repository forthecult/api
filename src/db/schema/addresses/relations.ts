import { relations } from "drizzle-orm";

import { addressesTable } from "./tables";
import { userTable } from "../users/tables";

export const addressRelations = relations(addressesTable, ({ one }) => ({
  user: one(userTable, {
    fields: [addressesTable.userId],
    references: [userTable.id],
  }),
}));
