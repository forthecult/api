import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Tracks each creator fee distribution run (daily cron or manual trigger).
 * Used for auditing and idempotency (e.g. one distribution per day).
 */
export const creatorFeeDistributionTable = pgTable(
  "creator_fee_distribution",
  {
    id: text("id").primaryKey(),
    createdAt: timestamp("created_at").notNull(),
    /** Total SOL (lamports) distributed in this run. */
    totalSolLamports: bigint("total_sol_lamports", { mode: "number" }).notNull(),
    /** Number of Tier 1 stakers who received a payout. */
    recipientCount: integer("recipient_count").notNull(),
    /** "pending" | "completed" | "failed" */
    status: text("status").notNull().default("pending"),
    /** Array of transaction signatures from this distribution. */
    txSignatures: jsonb("tx_signatures").$type<string[]>().notNull().default([]),
    /** Creator fee wallet balance (lamports) before distribution. */
    feeWalletBalance: bigint("fee_wallet_balance", { mode: "number" }),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (t) => [index("creator_fee_distribution_created_at_idx").on(t.createdAt)],
);

/**
 * Per-staker payout record for a given distribution.
 */
export const creatorFeePayoutTable = pgTable(
  "creator_fee_payout",
  {
    id: text("id").primaryKey(),
    distributionId: text("distribution_id")
      .notNull()
      .references(() => creatorFeeDistributionTable.id, { onDelete: "cascade" }),
    /** Solana wallet address that received SOL. */
    wallet: text("wallet").notNull(),
    /** SOL amount sent (lamports). */
    solLamports: bigint("sol_lamports", { mode: "number" }).notNull(),
    /** Staked token amount (raw, with decimals) used for pro-rata share. */
    stakedTokens: bigint("staked_tokens", { mode: "number" }).notNull(),
    /** Share as percentage (e.g. 25.5 for 25.5%). */
    sharePercent: text("share_percent").notNull(),
    /** Transaction signature that sent SOL to this wallet. */
    txSignature: text("tx_signature"),
  },
  (t) => [
    index("creator_fee_payout_distribution_id_idx").on(t.distributionId),
    index("creator_fee_payout_wallet_idx").on(t.wallet),
  ],
);
