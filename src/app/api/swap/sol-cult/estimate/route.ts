/**
 * GET /api/swap/sol-cult/estimate?solAmount=0.1
 * Returns { cultAmount: string } (human-readable CULT amount) for the given SOL input.
 * Used by mobile to show estimate before user confirms swap.
 */

import { Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { estimateCultFromSol } from "~/lib/pump-swap-cult";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";

const LAMPORTS_PER_SOL = 1e9;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const solStr = searchParams.get("solAmount");
  const solNum = solStr != null ? Number.parseFloat(solStr) : NaN;
  if (!Number.isFinite(solNum) || solNum <= 0) {
    return NextResponse.json(
      { error: "Query solAmount must be a positive number" },
      { status: 400 },
    );
  }
  const lamports = Math.floor(solNum * LAMPORTS_PER_SOL);
  if (lamports <= 0) {
    return NextResponse.json(
      { error: "SOL amount too small" },
      { status: 400 },
    );
  }

  try {
    const connection = new Connection(getSolanaRpcUrlServer());
    const result = await estimateCultFromSol(connection, lamports);
    if (!result) {
      return NextResponse.json(
        { error: "Pool unavailable or amount too small" },
        { status: 422 },
      );
    }
    return NextResponse.json({ cultAmount: result.cultAmount });
  } catch (e) {
    console.error("[swap] sol-cult estimate error:", e);
    return NextResponse.json(
      { error: "Failed to estimate" },
      { status: 500 },
    );
  }
}
