/**
 * POST /api/governance/stake/prepare
 * Body: { wallet: string, amount: string, lockDuration: number }
 *   - amount: human token amount (e.g. "1000")
 *   - lockDuration: 2592000 (30 days) or 31536000 (12 months)
 * Returns { transaction: string } (base64 serialized transaction for client to sign and send).
 */

import { getAccount } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getStakingProgramId,
  getVaultAta,
  getVaultAuthorityPda,
  isValidLockDuration,
  LOCK_12_MONTHS,
  LOCK_30_DAYS,
  type LockDuration,
} from "~/lib/cult-staking";
import { buildStakeTransaction } from "~/lib/cult-staking-instructions";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";
import {
  getActiveToken,
  TOKEN_2022_PROGRAM_ID_BASE58,
} from "~/lib/token-config";

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
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    const mint = new PublicKey(token.mint);
    const owner = new PublicKey(wallet);

    // check if vault ATA exists (need to create on first stake ever)
    let createVaultAta = false;
    const [vaultAuthority] = getVaultAuthorityPda(programId, mint);
    const vaultAta = getVaultAta(mint, vaultAuthority);
    try {
      await getAccount(
        connection,
        vaultAta,
        "confirmed",
        new PublicKey(TOKEN_2022_PROGRAM_ID_BASE58),
      );
    } catch {
      // vault ATA doesn't exist, need to create it
      createVaultAta = true;
    }

    const tx = buildStakeTransaction({
      amount: amountRaw,
      blockhash,
      createVaultAta,
      lastValidBlockHeight,
      lockDuration: lockDuration as LockDuration,
      mint,
      owner,
      programId,
      tokenDecimals: token.decimals,
      tokenSymbol: token.symbol,
    });

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const base64 = Buffer.from(serialized).toString("base64");
    return NextResponse.json({ transaction: base64 });
  } catch (e) {
    console.error("[governance] stake prepare error:", e);
    return NextResponse.json(
      { error: "Failed to build stake transaction" },
      { status: 500 },
    );
  }
}
