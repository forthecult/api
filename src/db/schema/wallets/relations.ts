import { relations } from "drizzle-orm";

import { userTable } from "../users/tables";
import { userWalletsTable } from "./tables";

export const userWalletRelations = relations(userWalletsTable, ({ one }) => ({
  user: one(userTable, {
    fields: [userWalletsTable.userId],
    references: [userTable.id],
  }),
}));
