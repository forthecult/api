import type { supportChatConversationTable } from "./tables";
import type { supportChatMessageTable } from "./tables";

export type SupportChatConversation =
  typeof supportChatConversationTable.$inferSelect;
export type NewSupportChatConversation =
  typeof supportChatConversationTable.$inferInsert;
export type SupportChatMessage = typeof supportChatMessageTable.$inferSelect;
export type NewSupportChatMessage = typeof supportChatMessageTable.$inferInsert;

export type ChatMessageRole = "customer" | "ai" | "staff";
