/**
 * POST /api/governance/unstake/prepare
 * Body: { wallet: string, amount: string }
 * Returns { transaction: string } (base64 serialized transaction for client to sign and send).
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildUnstakeTransaction,
  getStakingProgramId,
} from "~/lib/cult-staking";
import { getCultMintSolana } from "~/lib/token-gate";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";

const CULT_DECIMALS = 6;

const bodySchema = z.object({
  wallet: z.string().min(32).max(44),
  amount: z.string().min(1),
});

export async function POST(request: Request) {
  const programId = getStakingProgramId();
  if (!programId) {
    return NextResponse.json(
      { error: "Staking is not configured (missing program ID)" },
      { status: 503 },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { wallet, amount } = parsed.data;
  const amountNum = Number.parseFloat(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return NextResponse.json(
      { error: "Amount must be a positive number" },
      { status: 400 },
    );
  }
  const amountRaw = BigInt(Math.floor(amountNum * 10 ** CULT_DECIMALS));
  if (amountRaw <= 0n) {
    return NextResponse.json(
      { error: "Amount too small" },
      { status: 400 },
    );
  }

  try {
    const connection = new Connection(getSolanaRpcUrlServer());
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    const mint = new PublicKey(getCultMintSolana());
    const owner = new PublicKey(wallet);

    const tx = buildUnstakeTransaction({
      programId,
      mint,
      owner,
      amount: amountRaw,
      blockhash,
      lastValidBlockHeight,
    });

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const base64 = Buffer.from(serialized).toString("base64");
    return NextResponse.json({ transaction: base64 });
  } catch (e) {
    console.error("[governance] unstake prepare error:", e);
    return NextResponse.json(
      { error: "Failed to build unstake transaction" },
      { status: 500 },
    );
  }
}
