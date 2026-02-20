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

    // get associated token account for the wallet
    const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
    const ata = getAssociatedTokenAddressSync(
      mintPubkey,
      walletPubkey,
      false,
      token.tokenProgram === "token-2022"
        ? new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb")
        : new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    );

    const accountInfo = await connection.getAccountInfo(ata);
    if (!accountInfo) {
      return NextResponse.json({
        balance: "0",
        balanceRaw: "0",
        decimals: token.decimals,
        tokenSymbol: token.symbol,
      });
    }

    // parse token account data (first 8 bytes = mint, next 32 = owner, next 8 = amount)
    const data = accountInfo.data;
    const amountOffset = 64; // 32 (mint) + 32 (owner)
    const amountRaw = data.readBigUInt64LE(amountOffset);
    const balance = Number(amountRaw) / 10 ** token.decimals;

    return NextResponse.json({
      balance: balance.toFixed(token.decimals),
      balanceRaw: amountRaw.toString(),
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
