/**
 * GET /api/governance/pool-stats
 * Returns aggregate staking pool stats: total stakers, total staked amount.
 * Used by membership page for dynamic staking requirement calculations.
 */

import { Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { fetchPoolStats, getStakingProgramId } from "~/lib/cult-staking";
import { getActiveToken } from "~/lib/token-config";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";

export async function GET() {
  const token = getActiveToken();
  const programId = getStakingProgramId();
  if (!programId) {
    return NextResponse.json({
      totalStakers: 0,
      totalStaked: "0",
      totalStakedRaw: "0",
      decimals: token.decimals,
      tokenSymbol: token.symbol,
    });
  }
  try {
    const connection = new Connection(getSolanaRpcUrlServer());
    const pool = await fetchPoolStats(connection, programId);

    if (!pool) {
      return NextResponse.json({
        totalStakers: 0,
        totalStaked: "0",
        totalStakedRaw: "0",
        decimals: token.decimals,
        tokenSymbol: token.symbol,
      });
    }

    const human = Number(pool.totalStaked) / Math.pow(10, token.decimals);
    return NextResponse.json({
      totalStakers: pool.totalStakers,
      totalStaked: human.toFixed(token.decimals),
      totalStakedRaw: pool.totalStaked.toString(),
      decimals: token.decimals,
      tokenSymbol: token.symbol,
    });
  } catch (e) {
    console.error("[governance] pool-stats error:", e);
    return NextResponse.json({
      totalStakers: 0,
      totalStaked: "0",
      totalStakedRaw: "0",
      decimals: token.decimals,
      tokenSymbol: token.symbol,
    });
  }
}
