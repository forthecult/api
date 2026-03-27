/**
 * POST /api/governance/restake/prepare
 * Body: { wallet: string, lockTier: number, newLockDuration: number }
 *   - lockTier: current tier to restake from (0 = 30 days, 1 = 12 months)
 *   - newLockDuration: 2592000 (30 days) or 31536000 (12 months)
 * Builds one transaction: unstake then stake same amount with new lock (only valid when lock has expired).
 * Returns { transaction: string } (base64).
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  fetchStakeEntry,
  getLockStatus,
  getStakingProgramId,
  isValidLockDuration,
  LOCK_12_MONTHS,
  LOCK_30_DAYS,
  type LockDuration,
  type LockTier,
  TIER_30_DAYS,
  TIER_12_MONTHS,
} from "~/lib/cult-staking";
import { buildRestakeTransaction } from "~/lib/cult-staking-instructions";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";

const bodySchema = z.object({
  lockTier: z.number().refine((t) => t === TIER_30_DAYS || t === TIER_12_MONTHS, {
    message: `Lock tier must be ${TIER_30_DAYS} (30 days) or ${TIER_12_MONTHS} (12 months)`,
  }),
  newLockDuration: z.number().refine(isValidLockDuration, {
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
  const { lockTier, newLockDuration, wallet } = parsed.data;

  try {
    const connection = new Connection(getSolanaRpcUrlServer());

    // verify user has a stake for this tier
    const stake = await fetchStakeEntry(
      connection,
      programId,
      wallet,
      lockTier as LockTier,
    );
    if (!stake || stake.amount === 0n) {
      return NextResponse.json(
        { error: "No staked balance for this tier to restake" },
        { status: 400 },
      );
    }

    const lockStatus = getLockStatus(stake);
    if (lockStatus.isLocked) {
      return NextResponse.json(
        {
          error:
            "Lock has not expired yet. Restake is available after the lock period ends.",
          secondsRemaining: lockStatus.secondsRemaining,
        },
        { status: 400 },
      );
    }

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    const owner = new PublicKey(wallet);

    const tx = buildRestakeTransaction({
      amount: stake.amount,
      blockhash,
      lastValidBlockHeight,
      lockDuration: newLockDuration as LockDuration,
      oldLockTier: lockTier as LockTier,
      owner,
      programId,
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
