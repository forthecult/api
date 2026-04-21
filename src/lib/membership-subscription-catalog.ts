import "server-only";
import { and, eq, sql } from "drizzle-orm";

import { db } from "~/db";
import { subscriptionOfferTable, subscriptionPlanTable } from "~/db/schema";
import { SUBSCRIPTION_PRICES } from "~/lib/membership-tiers";

/** Single catalog offer: paid membership (BASE / PRIME / APEX). */
let membershipCatalogSeeded = false;

export const MEMBERSHIP_OFFER_SLUG = "membership";
export const MEMBERSHIP_OFFER_ID = "sub_offer_membership";

export type MembershipBillingInterval = "annual" | "monthly";

export interface MembershipPlanMetadata {
  billingInterval: MembershipBillingInterval;
  membershipTier: number;
}

/** Ensures `subscription_offer` + six `subscription_plan` rows exist for membership. Idempotent. */
export async function ensureMembershipCatalogSeeded(): Promise<void> {
  if (membershipCatalogSeeded) return;
  const now = new Date();
  const [existingOffer] = await db
    .select({ id: subscriptionOfferTable.id })
    .from(subscriptionOfferTable)
    .where(eq(subscriptionOfferTable.slug, MEMBERSHIP_OFFER_SLUG))
    .limit(1);

  if (!existingOffer) {
    await db.insert(subscriptionOfferTable).values({
      description:
        "CULT membership: shipping, eSIM, governance, and perks (same tiers as staking).",
      id: MEMBERSHIP_OFFER_ID,
      metadata: { kind: "membership" },
      name: "Membership",
      published: true,
      slug: MEMBERSHIP_OFFER_SLUG,
      updatedAt: now,
    });
  }

  for (const price of SUBSCRIPTION_PRICES) {
    const tier = price.tierId;
    for (const interval of ["monthly", "annual"] as const) {
      const planId =
        interval === "monthly" ? `mem_plan_${tier}_m` : `mem_plan_${tier}_a`;
      const intervalUnit = interval === "monthly" ? "month" : "year";
      const priceCents =
        interval === "monthly"
          ? Math.round(price.monthlyUsd * 100)
          : Math.round(price.annualUsd * 100);
      const stripePriceId =
        interval === "monthly"
          ? (price.monthlyPriceId ?? null)
          : (price.annualPriceId ?? null);
      const paypalPlanId =
        interval === "monthly"
          ? (price.paypalMonthlyPlanId ?? null)
          : (price.paypalAnnualPlanId ?? null);

      const [existing] = await db
        .select({ id: subscriptionPlanTable.id })
        .from(subscriptionPlanTable)
        .where(eq(subscriptionPlanTable.id, planId))
        .limit(1);

      const metadata: MembershipPlanMetadata = {
        billingInterval: interval,
        membershipTier: tier,
      };
      const metadataJson = metadata as unknown as Record<string, unknown>;

      if (existing) {
        await db
          .update(subscriptionPlanTable)
          .set({
            currency: "USD",
            displayName: `${price.tierName} · ${interval === "monthly" ? "Monthly" : "Annual"}`,
            intervalCount: 1,
            intervalUnit,
            metadata: metadataJson,
            offerId: MEMBERSHIP_OFFER_ID,
            payCryptoManual: false,
            paypalPlanId,
            payPaypal: Boolean(paypalPlanId),
            payStripe: Boolean(stripePriceId),
            priceCents,
            published: true,
            sortOrder: tier * 10 + (interval === "monthly" ? 0 : 1),
            stripePriceId,
            updatedAt: now,
          })
          .where(eq(subscriptionPlanTable.id, planId));
      } else {
        await db.insert(subscriptionPlanTable).values({
          createdAt: now,
          currency: "USD",
          displayName: `${price.tierName} · ${interval === "monthly" ? "Monthly" : "Annual"}`,
          id: planId,
          intervalCount: 1,
          intervalUnit,
          metadata: metadataJson,
          offerId: MEMBERSHIP_OFFER_ID,
          payCryptoManual: false,
          paypalPlanId,
          payPaypal: Boolean(paypalPlanId),
          payStripe: Boolean(stripePriceId),
          priceCents,
          published: true,
          sortOrder: tier * 10 + (interval === "monthly" ? 0 : 1),
          stripePriceId,
          updatedAt: now,
        });
      }
    }
  }
  membershipCatalogSeeded = true;
}

export async function findMembershipPlanByTierInterval(
  tier: number,
  interval: MembershipBillingInterval,
) {
  await ensureMembershipCatalogSeeded();
  const [row] = await db
    .select({
      offer: subscriptionOfferTable,
      plan: subscriptionPlanTable,
    })
    .from(subscriptionPlanTable)
    .innerJoin(
      subscriptionOfferTable,
      eq(subscriptionPlanTable.offerId, subscriptionOfferTable.id),
    )
    .where(
      and(
        eq(subscriptionOfferTable.slug, MEMBERSHIP_OFFER_SLUG),
        sql`${subscriptionPlanTable.metadata}->>'membershipTier' = ${String(tier)}`,
        sql`${subscriptionPlanTable.metadata}->>'billingInterval' = ${interval}`,
      ),
    )
    .limit(1);
  return row ?? null;
}

export function parseMembershipPlanMetadata(
  row: typeof subscriptionPlanTable.$inferSelect,
): MembershipPlanMetadata | null {
  const m = row.metadata as null | Record<string, unknown> | undefined;
  const tier = m?.membershipTier;
  const bi = m?.billingInterval;
  if (typeof tier !== "number" || tier < 1 || tier > 3) return null;
  if (bi !== "monthly" && bi !== "annual") return null;
  return { billingInterval: bi, membershipTier: tier };
}
