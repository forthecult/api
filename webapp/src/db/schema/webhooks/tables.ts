import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Webhook registration for AI agents: receive POST when order status changes. */
export const webhookRegistrationsTable = pgTable("webhook_registration", {
  createdAt: timestamp("created_at").notNull(),
  events: text("events"), // comma-separated e.g. "order.updated"
  id: text("id").primaryKey(),
  secret: text("secret"),
  url: text("url").notNull(),
});
