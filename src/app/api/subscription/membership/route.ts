/**
 * GET /api/subscription/membership
 *
 * Returns the authenticated user's active membership subscription (catalog `subscription_instance`).
 */

import { and, desc, eq, or } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  subscriptionInstanceTable,
  subscriptionOfferTable,
  subscriptionPlanTable,
} from "~/db/schema";
import { auth } from "~/lib/auth";
import {
  ensureMembershipCatalogSeeded,
  MEMBERSHIP_OFFER_SLUG,
  parseMembershipPlanMetadata,
} from "~/lib/membership-subscription-catalog";
import { SUBSCRIPTION_PRICES } from "~/lib/membership-tiers";

const TIER_NAMES: Record<number, string> = {
  1: "APEX",
  2: "PRIME",
  3: "BASE",
};

export async function GET(request: NextRequest) {
  await ensureMembershipCatalogSeeded();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [row] = await db
    .select({
      instance: subscriptionInstanceTable,
      plan: subscriptionPlanTable,
    })
    .from(subscriptionInstanceTable)
    .innerJoin(
      subscriptionOfferTable,
      eq(subscriptionInstanceTable.offerId, subscriptionOfferTable.id),
    )
    .innerJoin(
      subscriptionPlanTable,
      eq(subscriptionInstanceTable.planId, subscriptionPlanTable.id),
    )
    .where(
      and(
        eq(subscriptionOfferTable.slug, MEMBERSHIP_OFFER_SLUG),
        eq(subscriptionInstanceTable.userId, session.user.id),
        or(
          eq(subscriptionInstanceTable.status, "active"),
          eq(subscriptionInstanceTable.status, "trialing"),
          eq(subscriptionInstanceTable.status, "past_due"),
        ),
      ),
    )
    .orderBy(desc(subscriptionInstanceTable.updatedAt))
    .limit(1);

  if (!row) {
    return NextResponse.json({ subscription: null });
  }

  const { instance: sub, plan } = row;
  const meta = parseMembershipPlanMetadata(plan);
  const tier = meta?.membershipTier ?? null;
  const intervalLabel = meta?.billingInterval ?? "monthly";

  const priceRow =
    tier != null
      ? SUBSCRIPTION_PRICES.find((p) => p.tierId === tier)
      : undefined;

  const billingProvider =
    sub.billingProvider === "paypal"
      ? "paypal"
      : sub.billingProvider === "crypto_manual"
        ? "crypto_manual"
        : "stripe";

  return NextResponse.json({
    subscription: {
      billingProvider,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
      interval: intervalLabel,
      monthlyPrice:
        priceRow && tier != null
          ? intervalLabel === "annual"
            ? priceRow.annualUsd / 12
            : priceRow.monthlyUsd
          : null,
      status: sub.status,
      tier,
      tierName:
        tier != null ? (TIER_NAMES[tier] ?? `Tier ${tier}`) : "Membership",
    },
  });
}
