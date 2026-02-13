/**
 * GET /api/esim/membership-claim/status?wallet=<base58>
 *
 * Returns the user's membership eSIM claim status for a given wallet.
 * Used by the membership page to determine if the user can claim or has already claimed.
 */

import { Connection } from "@solana/web3.js";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCurrentUser } from "~/lib/auth";
import { fetchUserStake, getStakingProgramId } from "~/lib/cult-staking";
import { db } from "~/db";
import { membershipEsimClaimsTable } from "~/db/schema";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";

const CULT_DECIMALS = 6;

const TIER_THRESHOLDS = [
  { id: 1, minStake: 500_000 },
  { id: 2, minStake: 200_000 },
  { id: 3, minStake: 75_000 },
  { id: 4, minStake: 25_000 },
] as const;

function detectTier(stakedHuman: number): number | null {
  for (const tier of TIER_THRESHOLDS) {
    if (stakedHuman >= tier.minStake) return tier.id;
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

  // Check on-chain staking
  const programId = getStakingProgramId();
  if (!programId) {
    return NextResponse.json({ eligible: false, claimed: false, tier: null });
  }

  try {
    const connection = new Connection(getSolanaRpcUrlServer());
    const stakeData = await fetchUserStake(connection, programId, wallet);
    if (!stakeData || stakeData.amount === 0n) {
      return NextResponse.json({ eligible: false, claimed: false, tier: null });
    }

    const stakedHuman =
      Number(stakeData.amount) / Math.pow(10, CULT_DECIMALS);
    const tier = detectTier(stakedHuman);
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
