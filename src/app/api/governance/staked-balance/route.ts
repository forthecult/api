/**
 * GET /api/governance/staked-balance?wallet=<base58>
 * Returns staked token amount + lock status (on-chain staking program).
 * Returns 0 / unlocked if program not deployed or no stake.
 */

import { Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";

import {
  fetchUserStake,
  getLockStatus,
  getStakingProgramId,
  lockDurationLabel,
} from "~/lib/cult-staking";
import { getActiveToken } from "~/lib/token-config";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet")?.trim();
  if (!wallet) {
    return NextResponse.json(
      { error: "Missing wallet query parameter" },
      { status: 400 },
    );
  }
  const token = getActiveToken();
  const programId = getStakingProgramId();
  if (!programId) {
    return NextResponse.json({
      stakedBalance: "0",
      stakedBalanceRaw: "0",
      decimals: token.decimals,
      tokenSymbol: token.symbol,
      lock: null,
    });
  }
  try {
    const connection = new Connection(getSolanaRpcUrlServer());
    const stake = await fetchUserStake(connection, programId, wallet);

    if (!stake || stake.amount === 0n) {
      return NextResponse.json({
        stakedBalance: "0",
        stakedBalanceRaw: "0",
        decimals: token.decimals,
        tokenSymbol: token.symbol,
        lock: null,
      });
    }

    const human = Number(stake.amount) / Math.pow(10, token.decimals);
    const lockStatus = getLockStatus(stake);

    return NextResponse.json({
      stakedBalance: human.toFixed(token.decimals),
      stakedBalanceRaw: stake.amount.toString(),
      decimals: token.decimals,
      tokenSymbol: token.symbol,
      lock: {
        isLocked: lockStatus.isLocked,
        secondsRemaining: lockStatus.secondsRemaining,
        unlocksAt: lockStatus.unlocksAt,
        durationLabel: lockStatus.durationLabel,
        stakedAt: new Date(stake.stakedAt * 1000).toISOString(),
        lockDurationSeconds: stake.lockDuration,
      },
    });
  } catch (e) {
    console.error("[governance] staked-balance error:", e);
    return NextResponse.json({
      stakedBalance: "0",
      stakedBalanceRaw: "0",
      decimals: token.decimals,
      tokenSymbol: token.symbol,
      lock: null,
    });
  }
}
