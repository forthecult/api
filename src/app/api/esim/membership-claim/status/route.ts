/**
 * GET /api/esim/membership-claim/status?wallet=<base58>
 *
 * Returns the user's membership eSIM claim status for a given wallet.
 * Uses live pricing to determine tier eligibility.
 */

import { Connection } from "@solana/web3.js";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCurrentUser } from "~/lib/auth";
import { fetchUserStake, getStakingProgramId } from "~/lib/cult-staking";
import { db } from "~/db";
import { membershipEsimClaimsTable } from "~/db/schema";
import { fetchTokenMarketData } from "~/lib/market-cap";
import { computeTierPricing } from "~/lib/membership-pricing";
import { getActiveToken } from "~/lib/token-config";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";

function detectTierFromPricing(
  stakedTokens: number,
  tiers: { tierId: number; tokensNeeded: number }[],
): number | null {
  const sorted = [...tiers].sort((a, b) => a.tierId - b.tierId);
  for (const t of sorted) {
    if (stakedTokens >= t.tokensNeeded) return t.tierId;
  }
  return null;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ eligible: false, claimed: false, tier: null });
  }

  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet")?.trim();
  if (!wallet) {
    return NextResponse.json({ eligible: false, claimed: false, tier: null });
  }

  const programId = getStakingProgramId();
  if (!programId) {
    return NextResponse.json({ eligible: false, claimed: false, tier: null });
  }

  try {
    const token = getActiveToken();
    const connection = new Connection(getSolanaRpcUrlServer());

    const [stakeData, market] = await Promise.all([
      fetchUserStake(connection, programId, wallet),
      fetchTokenMarketData(token.mint),
    ]);

    if (!stakeData || stakeData.amount === 0n) {
      return NextResponse.json({ eligible: false, claimed: false, tier: null });
    }
    if (!market || market.priceUsd <= 0) {
      return NextResponse.json({ eligible: false, claimed: false, tier: null });
    }

    const stakedHuman =
      Number(stakeData.amount) / Math.pow(10, token.decimals);
    const pricing = computeTierPricing(
      token,
      market.priceUsd,
      market.marketCapUsd,
      0,
    );
    const tier = detectTierFromPricing(stakedHuman, pricing.tiers);
    const eligible = tier !== null && tier <= 2;

    // Check if already claimed for this staking period
    const stakePeriodKey = `${wallet}:${stakeData.stakedAt}`;
    const claims = await db
      .select({
        id: membershipEsimClaimsTable.id,
        status: membershipEsimClaimsTable.status,
      })
      .from(membershipEsimClaimsTable)
      .where(
        and(
          eq(membershipEsimClaimsTable.userId, user.id),
          eq(membershipEsimClaimsTable.stakePeriodKey, stakePeriodKey),
        ),
      )
      .limit(1);

    const claimed = claims.length > 0;
    const claimStatus = claims[0]?.status ?? null;

    return NextResponse.json({
      eligible,
      claimed,
      claimStatus,
      tier,
      stakedAmount: stakedHuman,
    });
  } catch (e) {
    console.error("[membership-claim/status] Error:", e);
    return NextResponse.json({ eligible: false, claimed: false, tier: null });
  }
}
