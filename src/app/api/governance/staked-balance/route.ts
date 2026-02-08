/**
 * GET /api/governance/staked-balance?wallet=<base58>
 * Returns staked CULT amount (on-chain staking program). 0 if program not deployed or no stake.
 */

import { Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { fetchStakedBalance, getStakingProgramId } from "~/lib/cult-staking";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";

const CULT_DECIMALS = 6;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet")?.trim();
  if (!wallet) {
    return NextResponse.json(
      { error: "Missing wallet query parameter" },
      { status: 400 },
    );
  }
  const programId = getStakingProgramId();
  if (!programId) {
    return NextResponse.json({
      stakedBalance: "0",
      stakedBalanceRaw: "0",
      decimals: CULT_DECIMALS,
    });
  }
  try {
    const connection = new Connection(getSolanaRpcUrlServer());
    const raw = await fetchStakedBalance(connection, programId, wallet);
    const human = Number(raw) / Math.pow(10, CULT_DECIMALS);
    return NextResponse.json({
      stakedBalance: human.toFixed(CULT_DECIMALS),
      stakedBalanceRaw: raw.toString(),
      decimals: CULT_DECIMALS,
    });
  } catch (e) {
    console.error("[governance] staked-balance error:", e);
    return NextResponse.json(
      { stakedBalance: "0", stakedBalanceRaw: "0", decimals: CULT_DECIMALS },
    );
  }
}
