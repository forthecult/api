/**
 * Server-only: resolve CULT member tier (1–3) from a staking wallet or from tier history (when wallet is unlinked).
 * Returns null if staking is not configured or wallet has no stake.
 * Falls back to default token thresholds if market data is unavailable.
 */

import { Connection } from "@solana/web3.js";
import { and, desc, eq, gt } from "drizzle-orm";

import { db } from "~/db";
import {
  adminMembershipGrantTable,
  membershipTierHistoryTable,
} from "~/db/schema";
import { fetchUserStake, getStakingProgramId } from "~/lib/cult-staking";
import { fetchTokenMarketData } from "~/lib/market-cap";
import { computeTierPricing } from "~/lib/membership-pricing";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";
import { getActiveToken } from "~/lib/token-config";

// fallback token thresholds (used when market data is unavailable)
// these match the pricing at ~$0.00005/token with the bonding curve
// Tier 1 (best): $100+, Tier 2: $50+, Tier 3 (entry): $25+
const FALLBACK_TOKEN_THRESHOLDS: Record<number, number> = {
  1: 4_000_000,  // tier 1: ~$200 at $0.00005
  2: 2_000_000,  // tier 2: ~$100 at $0.00005
  3: 1_000_000,  // tier 3: ~$50 at $0.00005
};

export async function getMemberTierForWallet(
  wallet: string,
): Promise<null | number> {
  const programId = getStakingProgramId();
  if (!programId) return null;

  const trimmed = wallet?.trim();
  if (!trimmed || trimmed.length < 32) return null;

  let stakedHuman = 0;

  try {
    const token = getActiveToken();
    const connection = new Connection(getSolanaRpcUrlServer());

    const stakeData = await fetchUserStake(connection, programId, trimmed);
    if (!stakeData || stakeData.amount === 0n) return null;

    stakedHuman = Number(stakeData.amount) / 10 ** token.decimals;

    // try with market data first
    try {
      const market = await fetchTokenMarketData(token.mint);
      if (market && market.priceUsd > 0) {
        const pricing = computeTierPricing(
          token,
          market.priceUsd,
          market.marketCapUsd,
          0,
        );
        const tier = detectTierFromPricing(stakedHuman, pricing.tiers);
        if (tier != null) return tier;
      }
    } catch {
      // market data fetch failed, fall through to hardcoded thresholds
    }
  } catch (e) {
    console.error("[getMemberTierForWallet] error:", e);
    // if we at least got stakedHuman before the error, try fallback
  }

  // ALWAYS try fallback thresholds if we have any staked tokens
  if (stakedHuman >= FALLBACK_TOKEN_THRESHOLDS[1]) return 1;
  if (stakedHuman >= FALLBACK_TOKEN_THRESHOLDS[2]) return 2;
  if (stakedHuman >= FALLBACK_TOKEN_THRESHOLDS[3]) return 3;

  return null;
}

/**
 * Active admin-granted tier for a user (expiresAt > now). Returns null if none or expired.
 */
export async function getAdminGrantedTier(
  userId: string,
): Promise<null | number> {
  if (!userId?.trim()) return null;
  const now = new Date();
  const row = await db
    .select({ tier: adminMembershipGrantTable.tier })
    .from(adminMembershipGrantTable)
    .where(
      and(
        eq(adminMembershipGrantTable.userId, userId),
        gt(adminMembershipGrantTable.expiresAt, now),
      ),
    )
    .limit(1);
  const tier = row[0]?.tier;
  return typeof tier === "number" && tier >= 1 && tier <= 3 ? tier : null;
}

/**
 * Resolve member tier from the last known snapshot (membership_tier_history).
 * Used when the user is logged in but has no linked wallet (e.g. they staked then unlinked).
 * Returns the best tier from the most recent snapshot date for this user.
 * Admin-granted membership (active) takes precedence over tier history.
 */
export async function getMemberTierForUser(
  userId: string,
): Promise<null | number> {
  if (!userId?.trim()) return null;
  const adminTier = await getAdminGrantedTier(userId);
  if (adminTier != null) return adminTier;
  const rows = await db
    .select({
      snapshotDate: membershipTierHistoryTable.snapshotDate,
      tier: membershipTierHistoryTable.tier,
    })
    .from(membershipTierHistoryTable)
    .where(eq(membershipTierHistoryTable.userId, userId))
    .orderBy(desc(membershipTierHistoryTable.snapshotDate))
    .limit(100);

  if (rows.length === 0) return null;
  const mostRecentDate = rows[0]!.snapshotDate;
  let bestTier: null | number = null;
  for (const r of rows) {
    if (r.snapshotDate !== mostRecentDate) break;
    if (r.tier != null && (bestTier === null || r.tier < bestTier))
      bestTier = r.tier;
  }
  return bestTier;
}

function detectTierFromPricing(
  stakedTokens: number,
  tiers: { tierId: number; tokensNeeded: number }[],
): null | number {
  const sorted = [...tiers].sort((a, b) => a.tierId - b.tierId);
  for (const t of sorted) {
    if (stakedTokens >= t.tokensNeeded) return t.tierId;
  }
  return null;
}
