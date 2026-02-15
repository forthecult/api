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
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";
import { getActiveToken } from "~/lib/token-config";

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
      decimals: token.decimals,
      lock: null,
      stakedBalance: "0",
      stakedBalanceRaw: "0",
      tokenSymbol: token.symbol,
    });
  }
  try {
    const connection = new Connection(getSolanaRpcUrlServer());
    const stake = await fetchUserStake(connection, programId, wallet);

    if (!stake || stake.amount === 0n) {
      return NextResponse.json({
        decimals: token.decimals,
        lock: null,
        stakedBalance: "0",
        stakedBalanceRaw: "0",
        tokenSymbol: token.symbol,
      });
    }

    const human = Number(stake.amount) / 10 ** token.decimals;
    const lockStatus = getLockStatus(stake);

    return NextResponse.json({
      decimals: token.decimals,
      lock: {
        durationLabel: lockStatus.durationLabel,
        isLocked: lockStatus.isLocked,
        lockDurationSeconds: stake.lockDuration,
        secondsRemaining: lockStatus.secondsRemaining,
        stakedAt: new Date(stake.stakedAt * 1000).toISOString(),
        unlocksAt: lockStatus.unlocksAt,
      },
      stakedBalance: human.toFixed(token.decimals),
      stakedBalanceRaw: stake.amount.toString(),
      tokenSymbol: token.symbol,
    });
  } catch (e) {
    console.error("[governance] staked-balance error:", e);
    return NextResponse.json({
      decimals: token.decimals,
      lock: null,
      stakedBalance: "0",
      stakedBalanceRaw: "0",
      tokenSymbol: token.symbol,
    });
  }
}
