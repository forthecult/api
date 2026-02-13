/**
 * GET /api/governance/pool-stats
 * Returns aggregate staking pool stats: total stakers, total staked amount.
 * Used by membership page for dynamic staking requirement calculations.
 */

import { Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { fetchPoolStats, getStakingProgramId } from "~/lib/cult-staking";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";

const CULT_DECIMALS = 6;

export async function GET() {
  const programId = getStakingProgramId();
  if (!programId) {
    return NextResponse.json({
      totalStakers: 0,
      totalStaked: "0",
      totalStakedRaw: "0",
      decimals: CULT_DECIMALS,
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
        decimals: CULT_DECIMALS,
      });
    }

    const human = Number(pool.totalStaked) / Math.pow(10, CULT_DECIMALS);
    return NextResponse.json({
      totalStakers: pool.totalStakers,
      totalStaked: human.toFixed(CULT_DECIMALS),
      totalStakedRaw: pool.totalStaked.toString(),
      decimals: CULT_DECIMALS,
    });
  } catch (e) {
    console.error("[governance] pool-stats error:", e);
    return NextResponse.json({
      totalStakers: 0,
      totalStaked: "0",
      totalStakedRaw: "0",
      decimals: CULT_DECIMALS,
    });
  }
}
