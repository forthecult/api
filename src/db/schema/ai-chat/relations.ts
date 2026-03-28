import { relations } from "drizzle-orm";

import { userTable } from "../users/tables";
import {
  aiAgentTable,
  aiEncryptedBackupTable,
  aiMemoryTable,
  aiChatConversationTable,
  aiRagChunkTable,
} from "./tables";

export const aiAgentRelations = relations(aiAgentTable, ({ one }) => ({
  user: one(userTable, {
    fields: [aiAgentTable.userId],
    references: [userTable.id],
  }),
}));

export const aiMemoryRelations = relations(aiMemoryTable, ({ one }) => ({
  user: one(userTable, {
    fields: [aiMemoryTable.userId],
    references: [userTable.id],
  }),
}));

export const aiEncryptedBackupRelations = relations(
  aiEncryptedBackupTable,
  ({ one }) => ({
    user: one(userTable, {
      fields: [aiEncryptedBackupTable.userId],
      references: [userTable.id],
    }),
  }),
);

export const aiChatConversationRelations = relations(
  aiChatConversationTable,
  ({ one }) => ({
    user: one(userTable, {
      fields: [aiChatConversationTable.userId],
      references: [userTable.id],
    }),
  }),
);

export const aiRagChunkRelations = relations(aiRagChunkTable, ({ one }) => ({
  user: one(userTable, {
    fields: [aiRagChunkTable.userId],
    references: [userTable.id],
  }),
}));
