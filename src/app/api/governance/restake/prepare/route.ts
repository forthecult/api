/**
 * POST /api/governance/restake/prepare
 * Body: { wallet: string, amount: string, lockDuration: number }
 * Builds one transaction: unstake then stake same amount with new lock (only valid when lock has expired).
 * Returns { transaction: string } (base64).
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { z } from "zod";

import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  fetchUserStake,
  getStakingProgramId,
  isValidLockDuration,
  LOCK_12_MONTHS,
  LOCK_30_DAYS,
  type LockDuration,
} from "~/lib/cult-staking";
import { buildRestakeTransaction } from "~/lib/cult-staking-instructions";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";
import { getActiveToken } from "~/lib/token-config";

const bodySchema = z.object({
  amount: z.string().min(1),
  lockDuration: z.number().refine(isValidLockDuration, {
    message: `Lock duration must be ${LOCK_30_DAYS} (30 days) or ${LOCK_12_MONTHS} (12 months)`,
  }),
  wallet: z.string().min(32).max(44),
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
      { details: parsed.error.flatten(), error: "Invalid body" },
      { status: 400 },
    );
  }
  const { amount, lockDuration, wallet } = parsed.data;
  const token = getActiveToken();
  const amountNum = Number.parseFloat(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return NextResponse.json(
      { error: "Amount must be a positive number" },
      { status: 400 },
    );
  }
  const amountRaw = BigInt(Math.floor(amountNum * 10 ** token.decimals));
  if (amountRaw <= 0n) {
    return NextResponse.json({ error: "Amount too small" }, { status: 400 });
  }

  try {
    const connection = new Connection(getSolanaRpcUrlServer());
    const stake = await fetchUserStake(connection, programId, wallet);
    if (!stake || stake.amount === 0n) {
      return NextResponse.json(
        { error: "No staked balance to restake" },
        { status: 400 },
      );
    }
    if (amountRaw > stake.amount) {
      return NextResponse.json(
        { error: "Restake amount exceeds your staked balance" },
        { status: 400 },
      );
    }
    const now = Math.floor(Date.now() / 1000);
    if (stake.lockedUntil > now) {
      return NextResponse.json(
        {
          error:
            "Lock has not expired yet. Restake is available after the lock period ends.",
        },
        { status: 400 },
      );
    }

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    const mint = new PublicKey(token.mint);
    const owner = new PublicKey(wallet);
    const tokenProgram = token.tokenProgram
      ? new PublicKey(token.tokenProgram)
      : TOKEN_PROGRAM_ID;

    const tx = buildRestakeTransaction({
      amount: amountRaw,
      blockhash,
      lastValidBlockHeight,
      lockDuration: lockDuration as LockDuration,
      mint,
      owner,
      programId,
      tokenProgram,
    });

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const base64 = Buffer.from(serialized).toString("base64");
    return NextResponse.json({ transaction: base64 });
  } catch (e) {
    console.error("[governance] restake prepare error:", e);
    return NextResponse.json(
      { error: "Failed to build restake transaction" },
      { status: 500 },
    );
  }
}
