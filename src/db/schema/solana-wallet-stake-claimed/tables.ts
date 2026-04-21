import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/**
 * Solana wallets that were unlinked after being used for staking.
 * Such a wallet can only be re-linked to the same user (originalUserId), not to another account.
 * Prevents "double stake": one stake used for tier on two different accounts.
 */
export const solanaWalletStakeClaimedTable = pgTable(
  "solana_wallet_stake_claimed",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    /** User who originally staked with this wallet; only they can link it again. */
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    wallet: text("wallet").notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.wallet],
      name: "solana_wallet_stake_claimed_wallet_pk",
    }),
  ],
);
