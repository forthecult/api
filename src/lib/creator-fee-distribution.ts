/**
 * Creator fee distribution — daily SOL distribution to Tier 1 stakers.
 *
 * The creator fee wallet receives 5% of pump.fun trade fees. This module
 * distributes that SOL pro-rata to all Tier 1 stakers based on staked amount.
 */

import { createId } from "@paralleldrive/cuid2";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { eq, gte } from "drizzle-orm";

import { db } from "~/db";
import {
  creatorFeeDistributionTable,
  creatorFeePayoutTable,
} from "~/db/schema";
import { fetchAllStakers, getStakingProgramId } from "~/lib/cult-staking";
import { fetchTokenMarketData } from "~/lib/market-cap";
import { computeTierPricing } from "~/lib/membership-pricing";
import { getActiveToken } from "~/lib/token-config";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LAMPORTS_PER_SOL = 1e9;
/** Minimum SOL in creator fee wallet to run a distribution (avoid dust + fee waste). */
const MIN_DISTRIBUTABLE_SOL = 0.01;
const MIN_DISTRIBUTABLE_LAMPORTS = Math.floor(
  MIN_DISTRIBUTABLE_SOL * LAMPORTS_PER_SOL,
);
/** Solana transaction fee per tx (lamports). */
const FEE_PER_TX_LAMPORTS = 5_000;
/** Max transfer instructions per transaction to stay under size limit. */
const MAX_TRANSFERS_PER_TX = 20;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Tier1Staker {
  owner: string;
  amount: bigint;
  /** Human-readable token amount. */
  amountHuman: number;
}

export interface ShareEntry {
  wallet: string;
  lamports: number;
  stakedTokens: number;
  sharePercent: number;
}

export interface DistributionResult {
  ok: boolean;
  distributionId?: string;
  skipped?: string;
  recipientCount?: number;
  totalLamports?: number;
  txSignatures?: string[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Keypair
// ---------------------------------------------------------------------------

function getCreatorFeeKeypair(): Keypair | null {
  const secret = process.env.CREATOR_FEE_WALLET_SECRET?.trim();
  if (!secret) return null;
  try {
    const bytes = bs58.decode(secret);
    if (bytes.length !== 64) return null;
    return Keypair.fromSecretKey(bytes);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tier 1 stakers
// ---------------------------------------------------------------------------

/**
 * Fetch all stakers who qualify for Tier 1 using live pricing (market cap + staker count).
 */
export async function fetchTier1Stakers(
  connection: Connection,
  programId: PublicKey | null,
): Promise<Tier1Staker[]> {
  if (!programId) return [];

  const token = getActiveToken();
  const allStakers = await fetchAllStakers(connection, programId);
  if (allStakers.length === 0) return [];

  const market = await fetchTokenMarketData(token.mint);
  if (!market || market.priceUsd <= 0) return [];

  const pricing = computeTierPricing(
    token,
    market.priceUsd,
    market.marketCapUsd,
    allStakers.length,
  );
  const tier1 = pricing.tiers.find((t) => t.tierId === 1);
  if (!tier1 || tier1.tokensRaw === 0n) return [];

  const tier1Min = tier1.tokensRaw;
  const tier1Stakers: Tier1Staker[] = [];

  for (const s of allStakers) {
    if (s.amount >= tier1Min) {
      tier1Stakers.push({
        owner: s.owner,
        amount: s.amount,
        amountHuman: Number(s.amount) / 10 ** token.decimals,
      });
    }
  }

  return tier1Stakers;
}

// ---------------------------------------------------------------------------
// Pro-rata shares
// ---------------------------------------------------------------------------

/**
 * Compute pro-rata SOL shares. Deducts a reserve for tx fees.
 */
export function computeShares(
  stakers: Tier1Staker[],
  totalLamports: number,
): ShareEntry[] {
  if (stakers.length === 0 || totalLamports <= 0) return [];

  const numTxs = Math.ceil(stakers.length / MAX_TRANSFERS_PER_TX);
  const feeReserve = numTxs * FEE_PER_TX_LAMPORTS;
  const distributable = Math.max(0, totalLamports - feeReserve);
  if (distributable <= 0) return [];

  const totalStaked = stakers.reduce((sum, s) => sum + Number(s.amount), 0);
  if (totalStaked === 0) return [];

  const shares: ShareEntry[] = [];
  let assigned = 0;

  for (let i = 0; i < stakers.length; i++) {
    const s = stakers[i]!;
    const isLast = i === stakers.length - 1;
    const shareOfDistributable =
      (Number(s.amount) / totalStaked) * distributable;
    const lamports = isLast
      ? distributable - assigned
      : Math.floor(shareOfDistributable);
    assigned += lamports;

    if (lamports <= 0) continue;

    const sharePercent =
      totalStaked > 0 ? (Number(s.amount) / totalStaked) * 100 : 0;

    shares.push({
      wallet: s.owner,
      lamports,
      stakedTokens: Number(s.amount),
      sharePercent,
    });
  }

  return shares;
}

// ---------------------------------------------------------------------------
// Execute distribution (batch SOL transfers)
// ---------------------------------------------------------------------------

/**
 * Send SOL to each recipient in batches. Returns tx signatures and per-recipient sig mapping.
 */
async function executeDistribution(
  connection: Connection,
  shares: ShareEntry[],
  fromKeypair: Keypair,
): Promise<{ txSignatures: string[]; sigByIndex: Map<number, string> }> {
  const txSignatures: string[] = [];
  const sigByIndex = new Map<number, string>();
  let idx = 0;

  for (let i = 0; i < shares.length; i += MAX_TRANSFERS_PER_TX) {
    const batch = shares.slice(i, i + MAX_TRANSFERS_PER_TX);
    const tx = new Transaction();

    for (const sh of batch) {
      if (sh.lamports <= 0) continue;
      tx.add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: new PublicKey(sh.wallet),
          lamports: sh.lamports,
        }),
      );
    }

    if (tx.instructions.length === 0) continue;

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = fromKeypair.publicKey;

    const sig = await sendAndConfirmTransaction(connection, tx, [fromKeypair], {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });

    txSignatures.push(sig);
    for (let j = 0; j < batch.length; j++) {
      sigByIndex.set(idx + j, sig);
    }
    idx += batch.length;
  }

  return { txSignatures, sigByIndex };
}

// ---------------------------------------------------------------------------
// Idempotency: already ran today?
// ---------------------------------------------------------------------------

async function distributionAlreadyRanToday(): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const rows = await db
    .select({ id: creatorFeeDistributionTable.id })
    .from(creatorFeeDistributionTable)
    .where(gte(creatorFeeDistributionTable.createdAt, todayStart))
    .limit(1);

  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Run a full distribution: fetch Tier 1 stakers, compute shares, send SOL, record in DB.
 * Call from cron or admin trigger. Idempotent: skips if already ran today (when called from cron).
 */
export async function runDailyDistribution(options?: {
  force?: boolean;
}): Promise<DistributionResult> {
  const keypair = getCreatorFeeKeypair();
  if (!keypair) {
    return { ok: false, skipped: "CREATOR_FEE_WALLET_SECRET not set" };
  }

  const programId = getStakingProgramId();
  if (!programId) {
    return { ok: false, skipped: "Staking program not configured" };
  }

  if (!options?.force) {
    const alreadyRan = await distributionAlreadyRanToday();
    if (alreadyRan) {
      return { ok: true, skipped: "Distribution already ran today" };
    }
  }

  const connection = new Connection(getSolanaRpcUrlServer());
  const balance = await connection.getBalance(keypair.publicKey);

  if (balance < MIN_DISTRIBUTABLE_LAMPORTS) {
    return {
      ok: true,
      skipped: `Creator fee wallet balance below ${MIN_DISTRIBUTABLE_SOL} SOL`,
    };
  }

  const stakers = await fetchTier1Stakers(connection, programId);
  if (stakers.length === 0) {
    return { ok: true, skipped: "No Tier 1 stakers" };
  }

  const shares = computeShares(stakers, balance);
  if (shares.length === 0) {
    return { ok: true, skipped: "No distributable amount after fee reserve" };
  }

  const distributionId = createId();
  const now = new Date();

  try {
    await db.insert(creatorFeeDistributionTable).values({
      id: distributionId,
      createdAt: now,
      updatedAt: now,
      totalSolLamports: shares.reduce((s, sh) => s + sh.lamports, 0),
      recipientCount: shares.length,
      status: "pending",
      txSignatures: [],
      feeWalletBalance: balance,
    });
  } catch (e) {
    console.error(
      "[creator-fee-distribution] Failed to insert distribution:",
      e,
    );
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  try {
    const { txSignatures, sigByIndex } = await executeDistribution(
      connection,
      shares,
      keypair,
    );

    await db
      .update(creatorFeeDistributionTable)
      .set({
        status: "completed",
        txSignatures,
        updatedAt: now,
      })
      .where(eq(creatorFeeDistributionTable.id, distributionId));

    for (let i = 0; i < shares.length; i++) {
      const sh = shares[i]!;
      await db.insert(creatorFeePayoutTable).values({
        id: createId(),
        distributionId,
        wallet: sh.wallet,
        solLamports: sh.lamports,
        stakedTokens: sh.stakedTokens,
        sharePercent: sh.sharePercent.toFixed(4),
        txSignature: sigByIndex.get(i) ?? null,
      });
    }

    return {
      ok: true,
      distributionId,
      recipientCount: shares.length,
      totalLamports: shares.reduce((s, sh) => s + sh.lamports, 0),
      txSignatures,
    };
  } catch (e) {
    await db
      .update(creatorFeeDistributionTable)
      .set({ status: "failed", updatedAt: now })
      .where(eq(creatorFeeDistributionTable.id, distributionId));

    console.error("[creator-fee-distribution] Execute failed:", e);
    return {
      ok: false,
      distributionId,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
