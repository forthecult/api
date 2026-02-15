/**
 * GET /api/governance/pool-stats
 * Returns aggregate staking pool stats: total stakers, total staked amount.
 * Used by membership page for dynamic staking requirement calculations.
 */

import { Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { fetchPoolStats, getStakingProgramId } from "~/lib/cult-staking";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";
import { getActiveToken } from "~/lib/token-config";

export async function GET() {
  const token = getActiveToken();
  const programId = getStakingProgramId();
  if (!programId) {
    return NextResponse.json({
      decimals: token.decimals,
      tokenSymbol: token.symbol,
      totalStaked: "0",
      totalStakedRaw: "0",
      totalStakers: 0,
    });
  }
  try {
    const connection = new Connection(getSolanaRpcUrlServer());
    const pool = await fetchPoolStats(connection, programId);

    if (!pool) {
      return NextResponse.json({
        decimals: token.decimals,
        tokenSymbol: token.symbol,
        totalStaked: "0",
        totalStakedRaw: "0",
        totalStakers: 0,
      });
    }

    const human = Number(pool.totalStaked) / 10 ** token.decimals;
    return NextResponse.json({
      decimals: token.decimals,
      tokenSymbol: token.symbol,
      totalStaked: human.toFixed(token.decimals),
      totalStakedRaw: pool.totalStaked.toString(),
      totalStakers: pool.totalStakers,
    });
  } catch (e) {
    console.error("[governance] pool-stats error:", e);
    return NextResponse.json({
      decimals: token.decimals,
      tokenSymbol: token.symbol,
      totalStaked: "0",
      totalStakedRaw: "0",
      totalStakers: 0,
    });
  }
}
