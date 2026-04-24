import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/**
 * Server-side cart snapshot for abandon-flow detection. Client syncs while the shopper
 * is signed in; checkout calls `markShoppingCartSnapshotsPurchased` on order create.
 */
export const shoppingCartSnapshotTable = pgTable(
  "shopping_cart_snapshot",
  {
    abandonEnrolledAt: timestamp("abandon_enrolled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    email: text("email").notNull(),
    id: text("id").primaryKey(),
    itemsJson: jsonb("items_json").notNull().$type<unknown[]>(),
    lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
    purchaseCompletedAt: timestamp("purchase_completed_at"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("shopping_cart_snapshot_user_idx").on(t.userId),
    index("shopping_cart_snapshot_idle_idx").on(
      t.lastSyncedAt,
      t.purchaseCompletedAt,
      t.abandonEnrolledAt,
    ),
    index("shopping_cart_snapshot_email_idx").on(t.email),
  ],
);
