/**
 * GET /api/admin/customers/[id]/membership
 * Returns membership tier and staking info for the customer from on-chain data
 * plus tier history from membership_tier_history (daily snapshots).
 */

import { Connection } from "@solana/web3.js";
import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
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

export interface WalletMembershipInfo {
  address: string;
  stakedBalance: string;
  stakedBalanceRaw: string;
  tier: null | number;
  lock: null | {
    durationLabel: string;
    isLocked: boolean;
    unlocksAt: string;
    secondsRemaining: number;
    stakedAt: string;
  };
}

/** Consecutive tier period for display (e.g. "Tier 3 for 3 months"). */
export interface TierPeriod {
  endDate: string;
  startDate: string;
  tier: number;
}

export interface MembershipResponse {
  bestTier: null | number;
  history: {
    periods: TierPeriod[];
    rows: { date: string; stakedAmountRaw: string; tier: null | number; wallet: string }[];
  };
  memberSince: null | string;
  tokenSymbol: string;
  wallets: WalletMembershipInfo[];
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
    periods.push({ endDate: bestTierByDate[i - 1]!.date, startDate: start, tier });
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

    const wallets = await db
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

    if (wallets.length === 0) {
      return NextResponse.json({
        bestTier: null,
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

    for (const { address } of wallets) {
      const tier = programId
        ? await getMemberTierForWallet(address)
        : null;
      if (tier !== null && (bestTier === null || tier < bestTier)) {
        bestTier = tier;
      }

      const stake = programId
        ? await fetchUserStake(connection, programId, address)
        : null;

      const human = stake
        ? Number(stake.amount) / 10 ** token.decimals
        : 0;
      const lockStatus = stake ? getLockStatus(stake) : null;

      if (stake?.lockStart && (earliestStakedAt === null || stake.lockStart < earliestStakedAt)) {
        earliestStakedAt = stake.lockStart;
      }

      walletInfos.push({
        address,
        stakedBalance: human.toFixed(token.decimals),
        stakedBalanceRaw: stake?.amount?.toString() ?? "0",
        tier: tier ?? null,
        lock:
          stake && lockStatus
            ? {
                durationLabel: lockStatus.durationLabel,
                isLocked: lockStatus.isLocked,
                unlocksAt: lockStatus.unlocksAt,
                secondsRemaining: lockStatus.secondsRemaining,
                stakedAt: new Date(stake.lockStart * 1000).toISOString(),
              }
            : null,
      });
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
