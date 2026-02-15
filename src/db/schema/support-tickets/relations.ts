import { relations } from "drizzle-orm";

import { userTable } from "../users/tables";
import { supportTicketMessageTable, supportTicketTable } from "./tables";

export const supportTicketRelations = relations(
  supportTicketTable,
  ({ many, one }) => ({
    messages: many(supportTicketMessageTable),
    user: one(userTable, {
      fields: [supportTicketTable.userId],
      references: [userTable.id],
    }),
  }),
);

export const supportTicketMessageRelations = relations(
  supportTicketMessageTable,
  ({ one }) => ({
    ticket: one(supportTicketTable, {
      fields: [supportTicketMessageTable.ticketId],
      references: [supportTicketTable.id],
    }),
  }),
);
