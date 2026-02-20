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

  try {
    const connection = new Connection(getSolanaRpcUrlServer());
    const walletPubkey = new PublicKey(wallet);
    const mintPubkey = new PublicKey(token.mint);

    const tokenProgramId = token.tokenProgram === "token-2022"
      ? new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb")
      : new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

    // get associated token account for the wallet
    const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
    const ata = getAssociatedTokenAddressSync(
      mintPubkey,
      walletPubkey,
      false,
      tokenProgramId,
    );

    // use getTokenAccountBalance for reliable parsing (works with both Token and Token-2022)
    try {
      const balanceInfo = await connection.getTokenAccountBalance(ata);
      const balance = balanceInfo.value.uiAmountString ?? "0";
      const balanceRaw = balanceInfo.value.amount;

      return NextResponse.json({
        balance,
        balanceRaw,
        decimals: token.decimals,
        tokenSymbol: token.symbol,
      });
    } catch {
      // account doesn't exist or has no balance
      return NextResponse.json({
        balance: "0",
        balanceRaw: "0",
        decimals: token.decimals,
        tokenSymbol: token.symbol,
      });
    }
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
