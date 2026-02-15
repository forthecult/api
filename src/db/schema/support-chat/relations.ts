import { relations } from "drizzle-orm";

import { userTable } from "../users/tables";
import {
  supportChatConversationTable,
  supportChatMessageTable,
} from "./tables";

export const supportChatConversationRelations = relations(
  supportChatConversationTable,
  ({ many, one }) => ({
    messages: many(supportChatMessageTable),
    takenOverByUser: one(userTable, {
      fields: [supportChatConversationTable.takenOverBy],
      references: [userTable.id],
      relationName: "takenOverBy",
    }),
    user: one(userTable, {
      fields: [supportChatConversationTable.userId],
      references: [userTable.id],
    }),
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
