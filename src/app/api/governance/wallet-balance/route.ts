/**
 * GET /api/governance/wallet-balance?wallet=<base58>
 * Returns the CULT token balance in the user's wallet (not staked).
 *
 * kit-native. talks to solana via @solana/kit — no web3.js on this path.
 */

import { NextResponse } from "next/server";

import {
  getTokenBalanceAnyProgramKit,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "~/lib/solana-kit-rpc";
import {
  getActiveToken,
  TOKEN_2022_PROGRAM_ID_BASE58,
} from "~/lib/token-config";

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
  const zero = {
    balance: "0",
    balanceRaw: "0",
    decimals: token.decimals,
    tokenSymbol: token.symbol,
  };

  // prefer the configured token program so we save an rpc hop; the helper
  // still falls back to the other program if the ata isn't found there.
  const preferred =
    token.tokenProgram === TOKEN_2022_PROGRAM_ID_BASE58
      ? TOKEN_2022_PROGRAM_ADDRESS
      : undefined;

  try {
    const info = await getTokenBalanceAnyProgramKit(
      token.mint,
      wallet,
      preferred,
    );
    if (!info) return NextResponse.json(zero);

    const balance =
      info.uiAmountString !== ""
        ? info.uiAmountString
        : info.amount === 0n
          ? "0"
          : (Number(info.amount) / 10 ** info.decimals).toFixed(info.decimals);

    return NextResponse.json({
      balance,
      balanceRaw: info.amount.toString(),
      decimals: token.decimals,
      tokenSymbol: token.symbol,
    });
  } catch (e) {
    console.error("[governance] wallet-balance error:", e);
    return NextResponse.json(zero);
  }
}
