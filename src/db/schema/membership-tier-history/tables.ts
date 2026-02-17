import {
  bigint,
  date,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/**
 * Daily snapshot of membership tier and staked amount per wallet.
 * One row per (wallet, snapshot_date). Populated by a cron job that reads
 * on-chain stake and computes tier from market pricing.
 * Used to show tier history in admin (e.g. "Tier 3 for 3 months, then Tier 2").
 */
export const membershipTierHistoryTable = pgTable(
  "membership_tier_history",
  {
    /** Calendar date for this snapshot (UTC). One row per wallet per day. */
    snapshotDate: date("snapshot_date").notNull(),
    /** Solana wallet address. */
    wallet: text("wallet").notNull(),
    /** User ID when this wallet was linked (from user_wallet). Enables query by customer. */
    userId: text("user_id").references(() => userTable.id, { onDelete: "set null" }),

    /** Tier 1–3 or null if no stake / below tier 3. */
    tier: integer("tier"),
    /** Staked token amount (raw, with decimals). */
    stakedAmountRaw: bigint("staked_amount_raw", { mode: "number" }).notNull().default(0),
    /** Lock duration in seconds (2592000 | 31536000) or null. */
    lockDurationSeconds: bigint("lock_duration_seconds", { mode: "number" }),
    /** Unix timestamp when lock expires. */
    lockedUntilTs: bigint("locked_until_ts", { mode: "number" }),

    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.wallet, t.snapshotDate],
      name: "membership_tier_history_wallet_date_pk",
    }),
  ],
);
