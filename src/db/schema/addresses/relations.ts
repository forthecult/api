import { relations } from "drizzle-orm";

import { userTable } from "../users/tables";
import { addressesTable } from "./tables";

export const addressRelations = relations(addressesTable, ({ one }) => ({
  user: one(userTable, {
    fields: [addressesTable.userId],
    references: [userTable.id],
  }),
}));
