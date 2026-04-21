/**
 * POST /api/governance/unstake/prepare
 * Body: { wallet: string, lockTier: number }
 *   - lockTier: 0 (30 days) or 1 (12 months)
 * Returns { transaction: string } (base64 serialized transaction for client to sign and send).
 *
 * Note: The native program withdraws the full staked amount for the given tier.
 * There's no partial unstake — each tier's stake is withdrawn entirely.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  fetchStakeEntry,
  getLockStatus,
  getStakingProgramId,
  type LockTier,
  TIER_12_MONTHS,
  TIER_30_DAYS,
} from "~/lib/cult-staking";
import { buildUnstakeTransaction } from "~/lib/cult-staking-instructions";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";

const bodySchema = z.object({
  lockTier: z
    .number()
    .refine((t) => t === TIER_30_DAYS || t === TIER_12_MONTHS, {
      message: `Lock tier must be ${TIER_30_DAYS} (30 days) or ${TIER_12_MONTHS} (12 months)`,
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
  const { lockTier, wallet } = parsed.data;

  try {
    const connection = new Connection(getSolanaRpcUrlServer());

    // verify user has a stake for this tier and it's unlocked
    const stake = await fetchStakeEntry(
      connection,
      programId,
      wallet,
      lockTier as LockTier,
    );
    if (!stake || stake.amount === 0n) {
      return NextResponse.json(
        { error: "No staked balance for this tier" },
        { status: 400 },
      );
    }

    const lockStatus = getLockStatus(stake);
    if (lockStatus.isLocked) {
      return NextResponse.json(
        {
          error: `Tokens are still locked. Unlock in ${Math.ceil(lockStatus.secondsRemaining / 86400)} days.`,
          secondsRemaining: lockStatus.secondsRemaining,
        },
        { status: 400 },
      );
    }

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    const owner = new PublicKey(wallet);

    const tx = buildUnstakeTransaction({
      blockhash,
      lastValidBlockHeight,
      lockTier: lockTier as LockTier,
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
    console.error("[governance] unstake prepare error:", e);
    return NextResponse.json(
      { error: "Failed to build unstake transaction" },
      { status: 500 },
    );
  }
}
