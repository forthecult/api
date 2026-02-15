import { relations } from "drizzle-orm";

import { userTable } from "../users/tables";
import { customerCommentsTable } from "./tables";

export const customerCommentRelations = relations(
  customerCommentsTable,
  ({ one }) => ({
    author: one(userTable, {
      fields: [customerCommentsTable.authorId],
      references: [userTable.id],
      relationName: "customerCommentAuthor",
    }),
    customer: one(userTable, {
      fields: [customerCommentsTable.customerId],
      references: [userTable.id],
      relationName: "customerCommentCustomer",
    }),
  }),
);
