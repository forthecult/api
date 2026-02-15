/**
 * POST /api/esim/membership-claim
 *
 * Allows Tier 2+ stakers to claim their free membership eSIM.
 *
 * Body: { wallet: string, packageId: string }
 *   - wallet:    Solana wallet address (used to verify staking tier)
 *   - packageId: eSIM package the user selected to claim
 *
 * Flow:
 *   1. Verify user is authenticated
 *   2. Fetch on-chain staking data for the wallet
 *   3. Determine membership tier (must be >= Tier 2)
 *   4. Check they haven't already claimed for this staking period
 *   5. Create order + esim_order records (paid via "membership_claim")
 *   6. Provision the eSIM immediately (no payment step)
 *   7. Record the claim
 */

import { createId } from "@paralleldrive/cuid2";
import { Connection } from "@solana/web3.js";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "~/lib/auth";
import { fetchUserStake, getStakingProgramId } from "~/lib/cult-staking";
import { db } from "~/db";
import {
  esimOrdersTable,
  membershipEsimClaimsTable,
  orderItemsTable,
  ordersTable,
} from "~/db/schema";
import { fetchTokenMarketData } from "~/lib/market-cap";
import { computeTierPricing } from "~/lib/membership-pricing";
import { getActiveToken } from "~/lib/token-config";
import { getEsimPackageDetail } from "~/lib/esim-api";
import { fulfillEsimOrder } from "~/lib/esim-fulfillment";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";

// ---------------------------------------------------------------------------
// Tier detection using live pricing
// ---------------------------------------------------------------------------

/** Minimum tier required to claim a free eSIM. */
const MIN_CLAIM_TIER = 2;

/**
 * Detect tier by comparing staked token count against the live tier thresholds
 * derived from market cap / staker count.
 */
function detectTierFromPricing(
  stakedTokens: number,
  tiers: { tierId: number; tokensNeeded: number }[],
): number | null {
  // tiers are ordered 4→1 (entry→best); check from best first
  const sorted = [...tiers].sort((a, b) => a.tierId - b.tierId);
  for (const t of sorted) {
    if (stakedTokens >= t.tokensNeeded) return t.tierId;
  }
  return null;
}

// ---------------------------------------------------------------------------

const bodySchema = z.object({
  packageId: z.string().min(1),
  wallet: z.string().min(32).max(44),
});

export async function POST(request: Request) {
  // 1. Auth check
  const user = await getCurrentUser();
  if (!user?.id || !user.email) {
    return NextResponse.json(
      { status: false, message: "Authentication required" },
      { status: 401 },
    );
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: false, message: "Invalid JSON" },
      { status: 400 },
    );
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        status: false,
        message: "Invalid body",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  const { wallet, packageId } = parsed.data;

  // 3. Verify on-chain staking
  const programId = getStakingProgramId();
  if (!programId) {
    return NextResponse.json(
      { status: false, message: "Staking program not configured" },
      { status: 503 },
    );
  }

  const token = getActiveToken();
  const connection = new Connection(getSolanaRpcUrlServer());
  const stakeData = await fetchUserStake(connection, programId, wallet);
  if (!stakeData || stakeData.amount === 0n) {
    return NextResponse.json(
      { status: false, message: "No active stake found for this wallet" },
      { status: 403 },
    );
  }

  // Fetch live market data to compute tier thresholds
  const market = await fetchTokenMarketData(token.mint);
  if (!market || market.priceUsd <= 0) {
    return NextResponse.json(
      {
        status: false,
        message: "Unable to fetch token price data. Please try again.",
      },
      { status: 503 },
    );
  }

  const stakedHuman = Number(stakeData.amount) / 10 ** token.decimals;
  // stakerCount=0 here since we just need the MC-based thresholds
  const pricing = computeTierPricing(
    token,
    market.priceUsd,
    market.marketCapUsd,
    0,
  );
  const tier = detectTierFromPricing(stakedHuman, pricing.tiers);
  if (tier === null || tier > MIN_CLAIM_TIER) {
    return NextResponse.json(
      {
        status: false,
        message: `Tier 2 or above required to claim a free eSIM. Your current stake qualifies for ${tier ? `Tier ${tier}` : "no tier"}.`,
      },
      { status: 403 },
    );
  }

  // 4. Build a unique key for this staking period (wallet + staked_at timestamp)
  const stakePeriodKey = `${wallet}:${stakeData.stakedAt}`;

  // Check for existing claim in this staking period
  const existingClaims = await db
    .select({ id: membershipEsimClaimsTable.id })
    .from(membershipEsimClaimsTable)
    .where(
      and(
        eq(membershipEsimClaimsTable.userId, user.id),
        eq(membershipEsimClaimsTable.stakePeriodKey, stakePeriodKey),
      ),
    )
    .limit(1);

  if (existingClaims.length > 0) {
    return NextResponse.json(
      {
        status: false,
        message:
          "You have already claimed your free eSIM for this staking period. Your claim will renew if you re-stake.",
      },
      { status: 409 },
    );
  }

  // 5. Fetch package details
  const pkgResult = await getEsimPackageDetail(packageId);
  if (!pkgResult.status || !pkgResult.data) {
    return NextResponse.json(
      { status: false, message: "eSIM package not found" },
      { status: 404 },
    );
  }

  const pkg = pkgResult.data;
  const costCents = Math.round(Number(pkg.price) * 100);
  const dataQuantity = Number(pkg.data_quantity);
  const validityDays = Number(pkg.package_validity) || 1;
  const dataUnit =
    (pkg.data_unit && String(pkg.data_unit).toUpperCase()) === "MB"
      ? "MB"
      : "GB";
  const packageTypeVal =
    pkg.package_type === "DATA-VOICE-SMS" ? "DATA-VOICE-SMS" : "DATA-ONLY";
  const countryName =
    pkg.countries?.[0]?.name ?? pkg.romaing_countries?.[0]?.name ?? null;

  const now = new Date();
  const orderId = createId();
  const esimOrderId = createId();
  const orderItemId = createId();
  const claimId = createId();

  try {
    // 6. Create order records (membership claim = $0 to the user)
    await db.insert(ordersTable).values({
      id: orderId,
      createdAt: now,
      email: user.email.toLowerCase(),
      fulfillmentStatus: "unfulfilled",
      paymentMethod: "membership_claim",
      paymentStatus: "paid", // Free — no payment needed
      status: "confirmed",
      totalCents: 0, // Free to the member
      shippingFeeCents: 0,
      updatedAt: now,
      userId: user.id,
    });

    await db.insert(orderItemsTable).values({
      id: orderItemId,
      name: `eSIM (Tier ${tier} Membership): ${pkg.name}`,
      orderId,
      priceCents: 0,
      productId: null,
      quantity: 1,
    });

    await db.insert(esimOrdersTable).values({
      id: esimOrderId,
      userId: user.id,
      orderId,
      packageId,
      packageName: String(pkg.name ?? "eSIM"),
      packageType: packageTypeVal as "DATA-ONLY" | "DATA-VOICE-SMS",
      dataQuantity: Number.isNaN(dataQuantity) ? 0 : dataQuantity,
      dataUnit,
      validityDays,
      countryName,
      costCents,
      priceCents: 0, // Free to the member
      currency: "USD",
      paymentMethod: "membership_claim",
      paymentStatus: "paid",
      status: "pending", // Will be fulfilled immediately
      createdAt: now,
      updatedAt: now,
    });

    // Record the claim
    await db.insert(membershipEsimClaimsTable).values({
      id: claimId,
      userId: user.id,
      wallet,
      tier,
      stakePeriodKey,
      esimOrderId,
      status: "claimed",
      createdAt: now,
    });

    // 7. Provision immediately (same as post-payment fulfillment)
    const fulfillResult = await fulfillEsimOrder(orderId);

    if (fulfillResult.success) {
      await db
        .update(membershipEsimClaimsTable)
        .set({ status: "fulfilled" })
        .where(eq(membershipEsimClaimsTable.id, claimId));
    } else {
      await db
        .update(membershipEsimClaimsTable)
        .set({ status: "failed" })
        .where(eq(membershipEsimClaimsTable.id, claimId));
    }

    return NextResponse.json({
      status: true,
      data: {
        claimId,
        orderId,
        esimOrderId,
        tier,
        packageName: pkg.name,
        fulfilled: fulfillResult.success,
        message: fulfillResult.success
          ? "Your free eSIM has been provisioned! Check your email for the activation link, or visit your eSIM dashboard."
          : "Your claim was recorded but provisioning is pending. Check your eSIM dashboard shortly.",
      },
    });
  } catch (error) {
    console.error("[membership-claim] Error:", error);
    return NextResponse.json(
      { status: false, message: "Failed to process eSIM claim" },
      { status: 500 },
    );
  }
}
