/**
 * GET /api/swap/cult-sol/estimate?cultAmount=1000000
 * Returns { solAmount: string } (human-readable SOL amount) for selling the given CULT amount.
 */

import { NextResponse } from "next/server";

import { estimateSolFromCult } from "~/lib/pump-swap-cult";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";

const CULT_DECIMALS = 6;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cultStr = searchParams.get("cultAmount");
  const cultNum = cultStr != null ? Number.parseFloat(cultStr) : NaN;
  if (!Number.isFinite(cultNum) || cultNum <= 0) {
    return NextResponse.json(
      { error: "Query cultAmount must be a positive number" },
      { status: 400 },
    );
  }
  const cultRaw = Math.floor(cultNum * 10 ** CULT_DECIMALS).toString();
  if (cultRaw === "0") {
    return NextResponse.json(
      { error: "CULT amount too small" },
      { status: 400 },
    );
  }

  try {
    const { Connection } = await import("@solana/web3.js");
    const connection = new Connection(getSolanaRpcUrlServer());
    const result = await estimateSolFromCult(connection, cultRaw);
    if (!result) {
      return NextResponse.json(
        { error: "Pool unavailable or amount too small" },
        { status: 422 },
      );
    }
    return NextResponse.json({ solAmount: result.solAmount });
  } catch (e) {
    console.error("[swap] cult-sol estimate error:", e);
    return NextResponse.json(
      { error: "Failed to estimate" },
      { status: 500 },
    );
  }
}
