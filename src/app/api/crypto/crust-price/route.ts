/**
 * CRUST price in USD: pump.fun LP (CRUST/SOL) → SOL per token, then SOL/USD from Coingecko.
 * Used for footer and product CRUST display.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { getCoinGeckoSimplePrice } from "~/lib/coingecko";
import { getPumpTokenPriceInSol } from "~/lib/pump-price";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";

const CRUST_MINT_MAINNET = "HkBWJJiaUW5Kod4HpHWZiGD9PQVipmMiPDgiRPcNpump";

/** Cached 60s. Prefer /api/crypto/prices for all rates in one request. */
export const revalidate = 60;

export async function GET() {
  try {
    const rpcUrl = getSolanaRpcUrlServer();
    const connection = new Connection(rpcUrl);
    const crustMint = new PublicKey(CRUST_MINT_MAINNET);

    const [solPerToken, solData] = await Promise.all([
      getPumpTokenPriceInSol(connection, crustMint),
      getCoinGeckoSimplePrice(["solana"]),
    ]);

    const solUsd = solData?.solana?.usd;
    if (typeof solUsd !== "number" || solUsd <= 0 || solPerToken <= 0) {
      return NextResponse.json({ usd: 0 });
    }

    const crustUsd = solPerToken * solUsd;
    return NextResponse.json({ usd: crustUsd });
  } catch {
    return NextResponse.json({ usd: 0 });
  }
}
