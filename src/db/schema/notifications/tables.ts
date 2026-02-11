import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/** In-app (website) notifications for the notification widget. */
export const userNotificationTable = pgTable("user_notification", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  /** Notification type from notification-templates (e.g. order_shipped, password_reset) */
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  read: boolean("read").notNull().default(false),
  /** Optional: orderId, trackingUrl, etc. */
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull(),
}, (t) => [
  // M7: Index for looking up notifications by user
  index("notification_user_id_idx").on(t.userId),
]);
