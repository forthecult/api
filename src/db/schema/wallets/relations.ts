import { relations } from "drizzle-orm";

import { userWalletsTable } from "./tables";
import { userTable } from "../users/tables";

export const userWalletRelations = relations(userWalletsTable, ({ one }) => ({
  user: one(userTable, {
    fields: [userWalletsTable.userId],
    references: [userTable.id],
  }),
}));
