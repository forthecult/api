import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/** In-app (website) notifications for the notification widget. */
export const userNotificationTable = pgTable(
  "user_notification",
  {
    createdAt: timestamp("created_at").notNull(),
    description: text("description").notNull(),
    id: text("id").primaryKey(),
    /** Optional: orderId, trackingUrl, etc. */
    metadata: jsonb("metadata"),
    read: boolean("read").notNull().default(false),
    title: text("title").notNull(),
    /** Notification type from notification-templates (e.g. order_shipped, password_reset) */
    type: text("type").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (t) => [
    // M7: Index for looking up notifications by user
    index("notification_user_id_idx").on(t.userId),
  ],
);
