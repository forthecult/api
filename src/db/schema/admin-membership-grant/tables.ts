import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/**
 * Admin-granted membership: tier and expiry. When expiresAt > now, user gets this tier
 * for checkout/API (getMemberTierForUser, /api/user/membership). One active grant per user.
 */
export const adminMembershipGrantTable = pgTable("admin_membership_grant", {
  userId: text("user_id")
    .notNull()
    .primaryKey()
    .references(() => userTable.id, { onDelete: "cascade" }),
  /** Tier 1–3 (1 = best). */
  tier: integer("tier").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
