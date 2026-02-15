/**
 * GET /api/governance/proposals/[id]
 * Returns a single proposal with vote totals and optional user vote.
 */

import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { governanceProposalTable, governanceVoteTable } from "~/db/schema";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing proposal id" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet")?.trim();

  try {
    const [proposal] = await db
      .select()
      .from(governanceProposalTable)
      .where(eq(governanceProposalTable.id, id))
      .limit(1);

    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 },
      );
    }

    const totals = await db
      .select({
        choice: governanceVoteTable.choice,
        power: sql<number>`COALESCE(SUM(${governanceVoteTable.votingPower}), 0)::bigint`,
      })
      .from(governanceVoteTable)
      .where(eq(governanceVoteTable.proposalId, id))
      .groupBy(governanceVoteTable.choice);

    const forPower = totals.find((t) => t.choice === "for")?.power ?? 0;
    const againstPower = totals.find((t) => t.choice === "against")?.power ?? 0;
    const abstainPower = totals.find((t) => t.choice === "abstain")?.power ?? 0;

    let userVote: { choice: string; votingPower: number } | null = null;
    if (wallet) {
      const votes = await db
        .select({
          choice: governanceVoteTable.choice,
          votingPower: governanceVoteTable.votingPower,
          walletAddress: governanceVoteTable.walletAddress,
        })
        .from(governanceVoteTable)
        .where(eq(governanceVoteTable.proposalId, id));
      const myVote = votes.find((v) => v.walletAddress === wallet);
      if (myVote) {
        userVote = { choice: myVote.choice, votingPower: myVote.votingPower };
      }
    }

    return NextResponse.json({
      proposal,
      totals: {
        for: Number(forPower),
        against: Number(againstPower),
        abstain: Number(abstainPower),
      },
      userVote,
    });
  } catch (e) {
    console.error("[governance] get proposal error:", e);
    return NextResponse.json(
      { error: "Failed to fetch proposal" },
      { status: 500 },
    );
  }
}
