/**
 * POST /api/swap/sol-cult/prepare
 * Body: { wallet: string, solAmount: number }
 *   - solAmount: SOL amount (e.g. 0.1)
 * Returns { transaction: string, estimatedCultRaw: string } (base64 tx for client to sign and send).
 * Used by mobile app; webapp builds the swap in the client.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { z } from "zod";

import { buildSwapSolToCult } from "~/lib/pump-swap-cult";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";

const LAMPORTS_PER_SOL = 1e9;

const bodySchema = z.object({
  solAmount: z.number().positive().finite(),
  wallet: z.string().min(32).max(44),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { details: parsed.error.flatten(), error: "Invalid body" },
      { status: 400 },
    );
  }
  const { solAmount, wallet } = parsed.data;
  const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
  if (lamports <= 0) {
    return NextResponse.json(
      { error: "SOL amount too small" },
      { status: 400 },
    );
  }

  try {
    const connection = new Connection(getSolanaRpcUrlServer());
    const userPublicKey = new PublicKey(wallet);
    const { estimatedCultRaw, transaction } = await buildSwapSolToCult(
      connection,
      userPublicKey,
      lamports,
    );

    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const base64 = Buffer.from(serialized).toString("base64");
    return NextResponse.json({
      estimatedCultRaw,
      transaction: base64,
    });
  } catch (e) {
    console.error("[swap] sol-cult prepare error:", e);
    return NextResponse.json(
      { error: "Failed to build swap transaction" },
      { status: 500 },
    );
  }
}
