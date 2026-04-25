import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

export const userWalletsTable = pgTable(
  "user_wallet",
  {
    address: text("address").notNull(),
    chain: text("chain").notNull(), // "evm" | "solana"

    chainId: integer("chain_id"), // For EVM: 1, 8453, etc. Null for Solana
    createdAt: timestamp("created_at").notNull(),
    id: text("id").primaryKey(),

    isPrimary: boolean("is_primary").notNull().default(false),
    label: text("label"), // "Main wallet", "Phantom", etc.

    updatedAt: timestamp("updated_at").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (t) => [
    // Prevent duplicate wallet addresses per chain
    unique("user_wallet_chain_address").on(t.chain, t.address),
  ],
);
