import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Webhook registration for AI agents: receive POST when order status changes. */
export const webhookRegistrationsTable = pgTable("webhook_registration", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  secret: text("secret"),
  events: text("events"), // comma-separated e.g. "order.updated"
  createdAt: timestamp("created_at").notNull(),
});
