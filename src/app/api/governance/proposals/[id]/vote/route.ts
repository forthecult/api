/**
 * POST /api/governance/proposals/[id]/vote
 * Body: { wallet: string, choice: "for" | "against" | "abstain" }
 * Records vote with current CULT balance as voting power. One vote per wallet per proposal.
 */

import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "~/db";
import {
  governanceProposalTable,
  governanceVoteTable,
} from "~/db/schema";
import { Connection } from "@solana/web3.js";

import { getCultMintSolana } from "~/lib/token-gate";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";
import { getTokenBalanceAnyProgram } from "~/lib/solana-token-utils";

const voteSchema = z.object({
  wallet: z.string().min(32).max(44),
  choice: z.enum(["for", "against", "abstain"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: proposalId } = await params;
  if (!proposalId) {
    return NextResponse.json({ error: "Missing proposal id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { wallet, choice } = parsed.data;

  try {
    const [proposal] = await db
      .select()
      .from(governanceProposalTable)
      .where(eq(governanceProposalTable.id, proposalId))
      .limit(1);

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }
    if (proposal.status !== "active") {
      return NextResponse.json(
        { error: "Voting is not open for this proposal" },
        { status: 400 },
      );
    }
    const now = new Date();
    if (now < proposal.startAt || now > proposal.endAt) {
      return NextResponse.json(
        { error: "Voting window is closed" },
        { status: 400 },
      );
    }

    const [existing] = await db
      .select()
      .from(governanceVoteTable)
      .where(
        and(
          eq(governanceVoteTable.proposalId, proposalId),
          eq(governanceVoteTable.walletAddress, wallet),
        ),
      )
      .limit(1);
    if (existing) {
      return NextResponse.json(
        { error: "You have already voted on this proposal" },
        { status: 400 },
      );
    }

    const connection = new Connection(getSolanaRpcUrlServer());
    const mint = getCultMintSolana();
    const balance = await getTokenBalanceAnyProgram(connection, mint, wallet);
    const votingPower = balance?.amount ?? 0n;
    if (votingPower <= 0n) {
      return NextResponse.json(
        { error: "No CULT balance. Hold CULT to vote." },
        { status: 400 },
      );
    }

    const voteId = createId();
    await db.insert(governanceVoteTable).values({
      id: voteId,
      proposalId,
      walletAddress: wallet,
      choice,
      votingPower: Number(votingPower),
      createdAt: now,
    });

    return NextResponse.json({
      id: voteId,
      choice,
      votingPower: votingPower.toString(),
    });
  } catch (e) {
    console.error("[governance] vote error:", e);
    return NextResponse.json(
      { error: "Failed to record vote" },
      { status: 500 },
    );
  }
}
