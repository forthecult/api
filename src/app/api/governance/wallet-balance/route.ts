/**
 * GET /api/governance/wallet-balance?wallet=<base58>
 * Returns the CULT token balance in the user's wallet (not staked).
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

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

  const tokenPrograms = token.tokenProgram === "token-2022"
    ? [
        new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
        new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      ] as const
    : [new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")];

  try {
    const connection = new Connection(getSolanaRpcUrlServer());
    const walletPubkey = new PublicKey(wallet);
    const mintPubkey = new PublicKey(token.mint);
    const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");

    for (const tokenProgramId of tokenPrograms) {
      const ata = getAssociatedTokenAddressSync(
        mintPubkey,
        walletPubkey,
        false,
        tokenProgramId,
      );
      try {
        const balanceInfo = await connection.getTokenAccountBalance(ata);
        const amountRaw = balanceInfo.value.amount;
        const decimals = balanceInfo.value.decimals;
        const uiAmountString = balanceInfo.value.uiAmountString;
        const balance =
          uiAmountString != null && uiAmountString !== ""
            ? uiAmountString
            : amountRaw === "0"
              ? "0"
              : (Number(amountRaw) / 10 ** decimals).toFixed(decimals);
        return NextResponse.json({
          balance,
          balanceRaw: amountRaw,
          decimals: token.decimals,
          tokenSymbol: token.symbol,
        });
      } catch {
        continue;
      }
    }
    return NextResponse.json({
      balance: "0",
      balanceRaw: "0",
      decimals: token.decimals,
      tokenSymbol: token.symbol,
    });
  } catch (e) {
    console.error("[governance] wallet-balance error:", e);
    return NextResponse.json({
      balance: "0",
      balanceRaw: "0",
      decimals: token.decimals,
      tokenSymbol: token.symbol,
    });
  }
}
