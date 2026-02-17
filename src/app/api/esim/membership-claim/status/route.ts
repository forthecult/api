/**
 * GET /api/esim/membership-claim/status?wallet=<base58>
 *
 * Returns the user's membership eSIM claim status for a given wallet.
 * Uses live pricing to determine tier eligibility.
 */

import { Connection } from "@solana/web3.js";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { membershipEsimClaimsTable } from "~/db/schema";
import { getCurrentUser } from "~/lib/auth";
import { fetchUserStake, getStakingProgramId } from "~/lib/cult-staking";
import { fetchTokenMarketData } from "~/lib/market-cap";
import { computeTierPricing } from "~/lib/membership-pricing";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";
import { getActiveToken } from "~/lib/token-config";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ claimed: false, eligible: false, tier: null });
  }

  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet")?.trim();
  if (!wallet) {
    return NextResponse.json({ claimed: false, eligible: false, tier: null });
  }

  const programId = getStakingProgramId();
  if (!programId) {
    return NextResponse.json({ claimed: false, eligible: false, tier: null });
  }

  try {
    const token = getActiveToken();
    const connection = new Connection(getSolanaRpcUrlServer());

    const [stakeData, market] = await Promise.all([
      fetchUserStake(connection, programId, wallet),
      fetchTokenMarketData(token.mint),
    ]);

    if (!stakeData || stakeData.amount === 0n) {
      return NextResponse.json({ claimed: false, eligible: false, tier: null });
    }
    if (!market || market.priceUsd <= 0) {
      return NextResponse.json({ claimed: false, eligible: false, tier: null });
    }

    const stakedHuman = Number(stakeData.amount) / 10 ** token.decimals;
    const pricing = computeTierPricing(
      token,
      market.priceUsd,
      market.marketCapUsd,
      0,
    );
    const tier = detectTierFromPricing(stakedHuman, pricing.tiers);
    const eligible = tier === 1;

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
      claimed,
      claimStatus,
      eligible,
      stakedAmount: stakedHuman,
      tier,
    });
  } catch (e) {
    console.error("[membership-claim/status] Error:", e);
    return NextResponse.json({ claimed: false, eligible: false, tier: null });
  }
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
