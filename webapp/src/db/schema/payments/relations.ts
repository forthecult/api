import { relations } from "drizzle-orm";

import { userTable } from "../users/tables";
import { stripeCustomerTable } from "./tables";

export const stripeCustomerRelations = relations(
  stripeCustomerTable,
  ({ one }) => ({
    user: one(userTable, {
      fields: [stripeCustomerTable.userId],
      references: [userTable.id],
    }),
  }),
);
