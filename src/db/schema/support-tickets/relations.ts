import { relations } from "drizzle-orm";

import { supportTicketMessageTable, supportTicketTable } from "./tables";
import { userTable } from "../users/tables";

export const supportTicketRelations = relations(
  supportTicketTable,
  ({ one, many }) => ({
    user: one(userTable, {
      fields: [supportTicketTable.userId],
      references: [userTable.id],
    }),
    messages: many(supportTicketMessageTable),
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
