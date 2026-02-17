/**
 * POST /api/esim/membership-claim
 *
 * Allows Tier 1 stakers to claim their free membership eSIM.
 *
 * Body: { wallet: string, packageId: string }
 *   - wallet:    Solana wallet address (used to verify staking tier)
 *   - packageId: eSIM package the user selected to claim
 *
 * Flow:
 *   1. Verify user is authenticated
 *   2. Fetch on-chain staking data for the wallet
 *   3. Determine membership tier (must be Tier 1)
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

import { db } from "~/db";
import {
  esimOrdersTable,
  membershipEsimClaimsTable,
  orderItemsTable,
  ordersTable,
} from "~/db/schema";
import { getCurrentUser } from "~/lib/auth";
import { fetchUserStake, getStakingProgramId } from "~/lib/cult-staking";
import { getEsimPackageDetail } from "~/lib/esim-api";
import { fulfillEsimOrder } from "~/lib/esim-fulfillment";
import { fetchTokenMarketData } from "~/lib/market-cap";
import { computeTierPricing } from "~/lib/membership-pricing";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";
import { getActiveToken } from "~/lib/token-config";

// ---------------------------------------------------------------------------
// Tier detection using live pricing
// ---------------------------------------------------------------------------

/** Tier required to claim a free eSIM (Tier 1 = free eSIM). */
const MIN_CLAIM_TIER = 1;

/**
 * Detect tier by comparing staked token count against the live tier thresholds
 * derived from market cap / staker count.
 */
function detectTierFromPricing(
  stakedTokens: number,
  tiers: { tierId: number; tokensNeeded: number }[],
): null | number {
  // tiers are ordered 3→1 (entry→best); check from best first
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
      { message: "Authentication required", status: false },
      { status: 401 },
    );
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON", status: false },
      { status: 400 },
    );
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        details: parsed.error.flatten(),
        message: "Invalid body",
        status: false,
      },
      { status: 400 },
    );
  }
  const { packageId, wallet } = parsed.data;

  // 3. Verify on-chain staking
  const programId = getStakingProgramId();
  if (!programId) {
    return NextResponse.json(
      { message: "Staking program not configured", status: false },
      { status: 503 },
    );
  }

  const token = getActiveToken();
  const connection = new Connection(getSolanaRpcUrlServer());
  const stakeData = await fetchUserStake(connection, programId, wallet);
  if (!stakeData || stakeData.amount === 0n) {
    return NextResponse.json(
      { message: "No active stake found for this wallet", status: false },
      { status: 403 },
    );
  }

  // Fetch live market data to compute tier thresholds
  const market = await fetchTokenMarketData(token.mint);
  if (!market || market.priceUsd <= 0) {
    return NextResponse.json(
      {
        message: "Unable to fetch token price data. Please try again.",
        status: false,
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
  if (tier === null || tier !== MIN_CLAIM_TIER) {
    return NextResponse.json(
      {
        message: `Tier 1 required to claim a free eSIM. Your current stake qualifies for ${tier ? `Tier ${tier}` : "no tier"}.`,
        status: false,
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
        message:
          "You have already claimed your free eSIM for this staking period. Your claim will renew if you re-stake.",
        status: false,
      },
      { status: 409 },
    );
  }

  // 5. Fetch package details
  const pkgResult = await getEsimPackageDetail(packageId);
  if (!pkgResult.status || !pkgResult.data) {
    return NextResponse.json(
      { message: "eSIM package not found", status: false },
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
      createdAt: now,
      email: user.email.toLowerCase(),
      fulfillmentStatus: "unfulfilled",
      id: orderId,
      paymentMethod: "membership_claim",
      paymentStatus: "paid", // Free — no payment needed
      shippingFeeCents: 0,
      status: "confirmed",
      totalCents: 0, // Free to the member
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
      costCents,
      countryName,
      createdAt: now,
      currency: "USD",
      dataQuantity: Number.isNaN(dataQuantity) ? 0 : dataQuantity,
      dataUnit,
      id: esimOrderId,
      orderId,
      packageId,
      packageName: String(pkg.name ?? "eSIM"),
      packageType: packageTypeVal as "DATA-ONLY" | "DATA-VOICE-SMS",
      paymentMethod: "membership_claim",
      paymentStatus: "paid",
      priceCents: 0, // Free to the member
      status: "pending", // Will be fulfilled immediately
      updatedAt: now,
      userId: user.id,
      validityDays,
    });

    // Record the claim
    await db.insert(membershipEsimClaimsTable).values({
      createdAt: now,
      esimOrderId,
      id: claimId,
      stakePeriodKey,
      status: "claimed",
      tier,
      userId: user.id,
      wallet,
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
      data: {
        claimId,
        esimOrderId,
        fulfilled: fulfillResult.success,
        message: fulfillResult.success
          ? "Your free eSIM has been provisioned! Check your email for the activation link, or visit your eSIM dashboard."
          : "Your claim was recorded but provisioning is pending. Check your eSIM dashboard shortly.",
        orderId,
        packageName: pkg.name,
        tier,
      },
      status: true,
    });
  } catch (error) {
    console.error("[membership-claim] Error:", error);
    return NextResponse.json(
      { message: "Failed to process eSIM claim", status: false },
      { status: 500 },
    );
  }
}
