import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Governance proposals for CULT token holder voting.
 * Status: draft (not shown) | active (voting open) | ended (voting closed).
 */
export const governanceProposalTable = pgTable("governance_proposal", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("draft"), // "draft" | "active" | "ended"
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  /** Wallet or user that created the proposal (optional for anonymity). */
  createdBy: text("created_by"),
});

/**
 * Votes on governance proposals. One vote per wallet per proposal.
 * votingPower = CULT balance (raw, with decimals) at time of vote.
 */
export const governanceVoteTable = pgTable("governance_vote", {
  id: text("id").primaryKey(),
  proposalId: text("proposal_id")
    .notNull()
    .references(() => governanceProposalTable.id, { onDelete: "cascade" }),
  walletAddress: text("wallet_address").notNull(),
  /** "for" | "against" | "abstain" */
  choice: text("choice").notNull(),
  /** Token balance (raw amount with decimals) used as voting power when vote was cast */
  votingPower: bigint("voting_power", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at").notNull(),
});
