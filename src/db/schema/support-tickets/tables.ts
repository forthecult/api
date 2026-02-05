import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/** Support ticket: open, pending, closed. type: normal, urgent. */
export const supportTicketTable = pgTable("support_ticket", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"), // "open" | "pending" | "closed"
  type: text("type").notNull().default("normal"), // "normal" | "urgent"
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

/** Follow-up messages on a support ticket. role: customer | staff. userId: staff sender. */
export const supportTicketMessageTable = pgTable("support_ticket_message", {
  id: text("id").primaryKey(),
  ticketId: text("ticket_id")
    .notNull()
    .references(() => supportTicketTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "customer" | "staff"
  userId: text("user_id").references(() => userTable.id, { onDelete: "set null" }), // staff sender
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull(),
});
