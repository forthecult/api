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
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),

    chain: text("chain").notNull(), // "evm" | "solana"
    address: text("address").notNull(),
    chainId: integer("chain_id"), // For EVM: 1, 8453, etc. Null for Solana

    label: text("label"), // "Main wallet", "Phantom", etc.
    isPrimary: boolean("is_primary").notNull().default(false),

    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (t) => [
    // Prevent duplicate wallet addresses per chain
    unique("user_wallet_chain_address").on(t.chain, t.address),
  ],
);
