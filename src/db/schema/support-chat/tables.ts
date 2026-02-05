import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/**
 * Support chat conversation.
 * - userId set when customer is authenticated; guestId when anonymous (rate-limited).
 * - takenOverBy: when set, AI does not reply; staff replies instead.
 */
export const supportChatConversationTable = pgTable("support_chat_conversation", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => userTable.id, { onDelete: "cascade" }),
  guestId: text("guest_id"), // anonymous visitor id (client-generated, rate-limited)
  status: text("status").notNull().default("open"), // "open" | "closed"
  takenOverBy: text("taken_over_by").references(() => userTable.id, {
    onDelete: "set null",
  }), // admin user id; null = AI is replying
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

/**
 * Single message in a support chat.
 * role: "customer" | "ai" | "staff"
 * userId: set for staff messages (admin who sent the message).
 */
export const supportChatMessageTable = pgTable("support_chat_message", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => supportChatConversationTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "customer" | "ai" | "staff"
  userId: text("user_id").references(() => userTable.id, { onDelete: "set null" }), // staff sender
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

/** Key-value settings for support chat (e.g. widget_visible). */
export const supportChatSettingTable = pgTable("support_chat_setting", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
