import {
  bigint,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Governance proposals for CULT token holder voting.
 * Status: draft (not shown) | active (voting open) | ended (voting closed).
 */
export const governanceProposalTable = pgTable("governance_proposal", {
  createdAt: timestamp("created_at").notNull(),
  /** Wallet or user that created the proposal (optional for anonymity). */
  createdBy: text("created_by"),
  description: text("description").notNull(),
  endAt: timestamp("end_at").notNull(),
  id: text("id").primaryKey(),
  startAt: timestamp("start_at").notNull(),
  // TODO (L17): migrate status to pgEnum for type safety
  status: text("status").notNull().default("draft"), // "draft" | "active" | "ended"
  title: text("title").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

/**
 * Votes on governance proposals. One vote per wallet per proposal.
 * votingPower = CULT balance (raw, with decimals) at time of vote.
 */
export const governanceVoteTable = pgTable(
  "governance_vote",
  {
    /** "for" | "against" | "abstain" */
    choice: text("choice").notNull(),
    createdAt: timestamp("created_at").notNull(),
    id: text("id").primaryKey(),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => governanceProposalTable.id, { onDelete: "cascade" }),
    /** Token balance (raw amount with decimals) used as voting power when vote was cast */
    votingPower: bigint("voting_power", { mode: "number" }).notNull(),
    walletAddress: text("wallet_address").notNull(),
  },
  (t) => [
    // M43: One vote per wallet per proposal
    uniqueIndex("governance_vote_proposal_wallet_idx").on(
      t.proposalId,
      t.walletAddress,
    ),
  ],
);
