/**
 * Daily snapshot of membership tier and staked amount for each linked Solana wallet.
 * Writes one row per (wallet, date) to membership_tier_history. Run once per day (e.g. cron at 00:05 UTC).
 *
 * Required env:
 *   DATABASE_URL
 *   CULT_STAKING_PROGRAM_ID (optional; if unset, all rows get tier=null, stakedAmountRaw=0)
 *
 * Optional:
 *   SNAPSHOT_DATE=YYYY-MM-DD  – default: today UTC
 *   DRY_RUN=true              – log only, do not write to DB
 *
 * Run: bun run scripts/membership-tier-history-snapshot.ts
 * Cron: 5 0 * * * cd /path/to/webapp && bun run scripts/membership-tier-history-snapshot.ts
 */

import { Connection } from "@solana/web3.js";
import { eq } from "drizzle-orm";

import { db } from "~/db";
import { membershipTierHistoryTable } from "~/db/schema";
import { userWalletsTable } from "~/db/schema/wallets/tables";
import {
  fetchUserStake,
  getStakingProgramId,
} from "~/lib/cult-staking";
import { getMemberTierForWallet } from "~/lib/get-member-tier";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";
import { getActiveToken } from "~/lib/token-config";

function getSnapshotDate(): string {
  const env = process.env.SNAPSHOT_DATE?.trim();
  if (env) {
    const match = /^\d{4}-\d{2}-\d{2}$/.exec(env);
    if (match) return match[0];
  }
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

async function main() {
  const dryRun = process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1";
  const snapshotDate = getSnapshotDate();

  const programId = getStakingProgramId();
  getActiveToken(); // ensure token config loaded
  const connection = programId
    ? new Connection(getSolanaRpcUrlServer())
    : null;

  const wallets = await db
    .select({
      address: userWalletsTable.address,
      userId: userWalletsTable.userId,
    })
    .from(userWalletsTable)
    .where(eq(userWalletsTable.chain, "solana"));

  if (wallets.length === 0) {
    console.log("No linked Solana wallets. Exiting.");
    return;
  }

  const now = new Date();
  let updated = 0;
  let inserted = 0;

  for (const { address, userId } of wallets) {
    let tier: number | null = null;
    let stakedAmountRaw = 0;
    let lockDurationSeconds: number | null = null;
    let lockedUntilTs: number | null = null;

    if (programId && connection) {
      const stake = await fetchUserStake(connection, programId, address);
      if (stake && stake.amount > 0n) {
        stakedAmountRaw = Number(stake.amount);
        lockDurationSeconds = stake.lockDuration ?? null;
        lockedUntilTs = stake.lockedUntil ?? null;
        tier = await getMemberTierForWallet(address);
      }
    }

    const row = {
      createdAt: now,
      lockDurationSeconds,
      lockedUntilTs,
      snapshotDate,
      stakedAmountRaw,
      tier,
      updatedAt: now,
      userId,
      wallet: address,
    };

    if (dryRun) {
      console.log(
        `${address.slice(0, 8)}… tier=${tier ?? "—"} staked=${stakedAmountRaw} date=${snapshotDate}`,
      );
      inserted++;
      continue;
    }

    await db
      .insert(membershipTierHistoryTable)
      .values(row)
      .onConflictDoUpdate({
        target: [
          membershipTierHistoryTable.wallet,
          membershipTierHistoryTable.snapshotDate,
        ],
        set: {
          lockDurationSeconds: row.lockDurationSeconds,
          lockedUntilTs: row.lockedUntilTs,
          stakedAmountRaw: row.stakedAmountRaw,
          tier: row.tier,
          updatedAt: row.updatedAt,
          userId: row.userId,
        },
      });
    updated++;
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would upsert ${inserted} rows for ${snapshotDate}`);
  } else {
    console.log(
      `Upserted ${updated} rows for ${snapshotDate} (${wallets.length} wallets).`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
