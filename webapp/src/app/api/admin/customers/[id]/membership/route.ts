/**
 * GET /api/admin/customers/[id]/membership
 * Returns membership tier and staking info for the customer from on-chain data
 * plus tier history from membership_tier_history (daily snapshots).
 */

import { Connection } from "@solana/web3.js";
import { and, desc, eq, gt } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { accountTable, adminMembershipGrantTable } from "~/db/schema";
import { membershipTierHistoryTable } from "~/db/schema/membership-tier-history/tables";
import { userWalletsTable } from "~/db/schema/wallets/tables";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import {
  fetchUserStake,
  getLockStatus,
  getStakingProgramId,
} from "~/lib/cult-staking";
import { getMemberTierForWallet } from "~/lib/get-member-tier";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";
import { getActiveToken } from "~/lib/token-config";

export interface MembershipResponse {
  /** Admin-granted membership (active = expiresAt > now). */
  adminGrant: null | { expiresAt: string; tier: number };
  bestTier: null | number;
  history: {
    periods: TierPeriod[];
    rows: {
      date: string;
      stakedAmountRaw: string;
      tier: null | number;
      wallet: string;
    }[];
  };
  memberSince: null | string;
  tokenSymbol: string;
  wallets: WalletMembershipInfo[];
}

/** Consecutive tier period for display (e.g. "Tier 3 for 3 months"). */
export interface TierPeriod {
  endDate: string;
  startDate: string;
  tier: number;
}

export interface WalletMembershipInfo {
  address: string;
  lock: null | {
    durationLabel: string;
    isLocked: boolean;
    secondsRemaining: number;
    stakedAt: string;
    unlocksAt: string;
  };
  stakedBalance: string;
  stakedBalanceRaw: string;
  tier: null | number;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id: userId } = await params;

    const token = getActiveToken();
    const programId = getStakingProgramId();

    // check both userWalletsTable and accountTable for Solana wallets
    const walletsFromWalletsTable = await db
      .select({
        address: userWalletsTable.address,
      })
      .from(userWalletsTable)
      .where(
        and(
          eq(userWalletsTable.userId, userId),
          eq(userWalletsTable.chain, "solana"),
        ),
      );

    // also check accountTable for wallets linked via Solana auth
    const walletsFromAccountTable = await db
      .select({
        address: accountTable.accountId,
      })
      .from(accountTable)
      .where(
        and(
          eq(accountTable.userId, userId),
          eq(accountTable.providerId, "solana"),
        ),
      );

    // combine and deduplicate wallet addresses
    const allWalletAddresses = new Set<string>();
    for (const w of walletsFromWalletsTable) {
      if (w.address) allWalletAddresses.add(w.address);
    }
    for (const w of walletsFromAccountTable) {
      if (w.address) allWalletAddresses.add(w.address);
    }
    const wallets = Array.from(allWalletAddresses).map((address) => ({
      address,
    }));

    const now = new Date();
    const adminGrantRow = await db
      .select({
        expiresAt: adminMembershipGrantTable.expiresAt,
        tier: adminMembershipGrantTable.tier,
      })
      .from(adminMembershipGrantTable)
      .where(
        and(
          eq(adminMembershipGrantTable.userId, userId),
          gt(adminMembershipGrantTable.expiresAt, now),
        ),
      )
      .limit(1);
    const adminGrant =
      adminGrantRow.length > 0 &&
      adminGrantRow[0]!.tier >= 1 &&
      adminGrantRow[0]!.tier <= 3
        ? {
            expiresAt: adminGrantRow[0]!.expiresAt.toISOString(),
            tier: adminGrantRow[0]!.tier,
          }
        : null;

    if (wallets.length === 0) {
      return NextResponse.json({
        adminGrant,
        bestTier: adminGrant?.tier ?? null,
        history: { periods: [], rows: [] },
        memberSince: null,
        tokenSymbol: token.symbol,
        wallets: [],
      } satisfies MembershipResponse);
    }

    const connection = new Connection(getSolanaRpcUrlServer());
    const walletInfos: WalletMembershipInfo[] = [];
    let bestTier: null | number = null;
    let earliestStakedAt: null | number = null;

    // fallback tier thresholds (same as in get-member-tier.ts)
    // Tier 1 (best): highest requirement, Tier 3 (entry): lowest requirement
    const FALLBACK_THRESHOLDS: Record<number, number> = {
      1: 4_000_000, // tier 1
      2: 2_000_000, // tier 2
      3: 1_000_000, // tier 3
    };

    for (const { address } of wallets) {
      // fetch stake data first
      const stake = programId
        ? await fetchUserStake(connection, programId, address)
        : null;

      const human = stake ? Number(stake.amount) / 10 ** token.decimals : 0;
      const lockStatus = stake ? getLockStatus(stake) : null;

      // get tier from getMemberTierForWallet (includes market-based pricing)
      let tier = programId ? await getMemberTierForWallet(address) : null;

      // fallback: if we have stake but no tier, calculate from hardcoded thresholds
      if (tier === null && human > 0) {
        if (human >= FALLBACK_THRESHOLDS[1]) tier = 1;
        else if (human >= FALLBACK_THRESHOLDS[2]) tier = 2;
        else if (human >= FALLBACK_THRESHOLDS[3]) tier = 3;
      }

      if (tier !== null && (bestTier === null || tier < bestTier)) {
        bestTier = tier;
      }

      if (
        stake?.lockStart &&
        (earliestStakedAt === null || stake.lockStart < earliestStakedAt)
      ) {
        earliestStakedAt = stake.lockStart;
      }

      walletInfos.push({
        address,
        lock:
          stake && lockStatus
            ? {
                durationLabel: lockStatus.durationLabel,
                isLocked: lockStatus.isLocked,
                secondsRemaining: lockStatus.secondsRemaining,
                stakedAt: new Date(stake.lockStart * 1000).toISOString(),
                unlocksAt: lockStatus.unlocksAt,
              }
            : null,
        stakedBalance: human.toFixed(token.decimals),
        stakedBalanceRaw: stake?.amount?.toString() ?? "0",
        tier,
      });
    }

    if (adminGrant && (bestTier === null || adminGrant.tier < bestTier)) {
      bestTier = adminGrant.tier;
    }

    // Tier history from daily snapshots (membership_tier_history)
    const historyRows = await db
      .select({
        date: membershipTierHistoryTable.snapshotDate,
        stakedAmountRaw: membershipTierHistoryTable.stakedAmountRaw,
        tier: membershipTierHistoryTable.tier,
        wallet: membershipTierHistoryTable.wallet,
      })
      .from(membershipTierHistoryTable)
      .where(eq(membershipTierHistoryTable.userId, userId))
      .orderBy(desc(membershipTierHistoryTable.snapshotDate))
      .limit(500);

    const rows = historyRows.map((r) => ({
      date: r.date,
      stakedAmountRaw: String(r.stakedAmountRaw),
      tier: r.tier,
      wallet: r.wallet,
    }));

    // Best tier per day (min tier number = best), then chronological for period collapse
    const byDate = new Map<string, number>();
    for (const r of historyRows) {
      if (r.tier == null) continue;
      const existing = byDate.get(r.date);
      if (existing === undefined || r.tier < existing) {
        byDate.set(r.date, r.tier);
      }
    }
    const bestTierByDate = [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, tier]) => ({ date, tier }));
    const periods = buildTierPeriods(bestTierByDate);

    return NextResponse.json({
      adminGrant,
      bestTier,
      history: { periods, rows },
      memberSince:
        earliestStakedAt !== null
          ? new Date(earliestStakedAt * 1000).toISOString()
          : null,
      tokenSymbol: token.symbol,
      wallets: walletInfos,
    } satisfies MembershipResponse);
  } catch (err) {
    console.error("Admin customer membership error:", err);
    return NextResponse.json(
      { error: "Failed to load membership" },
      { status: 500 },
    );
  }
}

/** Build consecutive same-tier periods from best-tier-per-day. */
function buildTierPeriods(
  bestTierByDate: { date: string; tier: number }[],
): TierPeriod[] {
  if (bestTierByDate.length === 0) return [];
  const periods: TierPeriod[] = [];
  let start = bestTierByDate[0]!.date;
  let tier = bestTierByDate[0]!.tier;
  for (let i = 1; i < bestTierByDate.length; i++) {
    const row = bestTierByDate[i]!;
    if (row.tier === tier) continue;
    periods.push({
      endDate: bestTierByDate[i - 1]!.date,
      startDate: start,
      tier,
    });
    start = row.date;
    tier = row.tier;
  }
  periods.push({
    endDate: bestTierByDate[bestTierByDate.length - 1]!.date,
    startDate: start,
    tier,
  });
  return periods;
}
