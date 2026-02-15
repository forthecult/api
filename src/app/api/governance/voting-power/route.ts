/**
 * GET /api/governance/voting-power?wallet=<base58>
 * Returns CULT voting power = wallet balance + staked balance (on-chain program).
 */

import { Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { fetchStakedBalance, getStakingProgramId } from "~/lib/cult-staking";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";
import { getTokenBalanceAnyProgram } from "~/lib/solana-token-utils";
import { getCultMintSolana } from "~/lib/token-gate";

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
  try {
    const connection = new Connection(getSolanaRpcUrlServer());
    const mint = getCultMintSolana();
    const [walletResult, stakedRaw] = await Promise.all([
      getTokenBalanceAnyProgram(connection, mint, wallet),
      fetchStakedBalance(connection, getStakingProgramId(), wallet),
    ]);
    const walletRaw = walletResult?.amount ?? 0n;
    const decimals = walletResult?.decimals ?? CULT_DECIMALS;
    const totalRaw = walletRaw + stakedRaw;
    const human = Number(totalRaw) / 10 ** decimals;
    return NextResponse.json({
      decimals,
      stakedBalanceRaw: stakedRaw.toString(),
      votingPower: human.toFixed(decimals),
      votingPowerRaw: totalRaw.toString(),
      walletBalanceRaw: walletRaw.toString(),
    });
  } catch (e) {
    console.error("[governance] voting-power error:", e);
    return NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 },
    );
  }
}
