import type { supportChatConversationTable } from "./tables";
import type { supportChatMessageTable } from "./tables";

export type ChatMessageRole = "ai" | "customer" | "staff";
export type NewSupportChatConversation =
  typeof supportChatConversationTable.$inferInsert;
export type NewSupportChatMessage = typeof supportChatMessageTable.$inferInsert;
export type SupportChatConversation =
  typeof supportChatConversationTable.$inferSelect;

export type SupportChatMessage = typeof supportChatMessageTable.$inferSelect;
