import { relations } from "drizzle-orm";

import { supportChatConversationTable, supportChatMessageTable } from "./tables";
import { userTable } from "../users/tables";

export const supportChatConversationRelations = relations(
  supportChatConversationTable,
  ({ one, many }) => ({
    user: one(userTable, {
      fields: [supportChatConversationTable.userId],
      references: [userTable.id],
    }),
    takenOverByUser: one(userTable, {
      fields: [supportChatConversationTable.takenOverBy],
      references: [userTable.id],
      relationName: "takenOverBy",
    }),
    messages: many(supportChatMessageTable),
  }),
);

export const supportChatMessageRelations = relations(
  supportChatMessageTable,
  ({ one }) => ({
    conversation: one(supportChatConversationTable, {
      fields: [supportChatMessageTable.conversationId],
      references: [supportChatConversationTable.id],
    }),
  }),
);
