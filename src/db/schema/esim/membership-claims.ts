import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";
import { esimOrdersTable } from "./tables";

/**
 * Tracks free eSIM claims from membership staking tiers.
 *
 * Each staking period (identified by wallet + staked_at timestamp) allows
 * one claim per eligible tier. Prevents double-claiming while allowing
 * re-claims on new staking periods.
 */
export const membershipEsimClaimsTable = pgTable(
  "membership_esim_claim",
  {
    createdAt: timestamp("created_at").notNull(),
    /** The eSIM order created for this claim. */
    esimOrderId: text("esim_order_id").references(() => esimOrdersTable.id, {
      onDelete: "set null",
    }),

    id: text("id").primaryKey(),

    /** Unix timestamp of when the stake was made (from on-chain data).
     *  Used to scope claims to a specific staking period — if the user
     *  unstakes and re-stakes, they get a new staking period. */
    stakePeriodKey: text("stake_period_key").notNull(),

    /** Status of the claim. */
    status: text("status").notNull().default("claimed"), // "claimed" | "fulfilled" | "failed"

    /** Membership tier at time of claim (1 = best, 4 = entry). */
    tier: integer("tier").notNull(),

    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),

    /** Solana wallet that holds the stake. */
    wallet: text("wallet").notNull(),
  },
  (t) => [
    index("membership_esim_claim_user_idx").on(t.userId),
    index("membership_esim_claim_wallet_idx").on(t.wallet),
    index("membership_esim_claim_period_idx").on(t.wallet, t.stakePeriodKey),
  ],
);
