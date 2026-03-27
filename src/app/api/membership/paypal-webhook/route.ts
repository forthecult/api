/**
 * POST /api/membership/paypal-webhook
 *
 * PayPal billing webhooks for membership and catalog subscriptions (`subscription_instance`).
 */

import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { subscriptionInstanceTable, subscriptionPlanTable } from "~/db/schema";
import { findMembershipPlanByTierInterval } from "~/lib/membership-subscription-catalog";
import { getPayPalSubscription, verifyPayPalWebhookSignature } from "~/lib/paypal-billing";

function mapPayPalStatus(s: string | undefined): string {
  const u = (s ?? "").toUpperCase();
  if (u === "ACTIVE") return "active";
  if (u === "CANCELLED") return "canceled";
  if (u === "SUSPENDED") return "past_due";
  if (u === "EXPIRED") return "canceled";
  return (s ?? "active").toLowerCase();
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let event: {
    event_type?: string;
    resource?: {
      custom_id?: string;
      id?: string;
      plan_id?: string;
      status?: string;
    };
  };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const skipVerify = process.env.PAYPAL_SKIP_WEBHOOK_VERIFY === "true";
  if (!skipVerify) {
    const ok = await verifyPayPalWebhookSignature(
      request.headers,
      JSON.parse(rawBody),
    );
    if (!ok) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }
  }

  const eventType = event.event_type ?? "";
  const resource = event.resource;
  const subscriptionId = resource?.id;
  if (!subscriptionId) {
    return NextResponse.json({ received: true });
  }

  try {
    if (
      eventType === "BILLING.SUBSCRIPTION.ACTIVATED" ||
      eventType === "BILLING.SUBSCRIPTION.UPDATED" ||
      eventType === "BILLING.SUBSCRIPTION.CANCELLED" ||
      eventType === "BILLING.SUBSCRIPTION.EXPIRED" ||
      eventType === "BILLING.SUBSCRIPTION.SUSPENDED"
    ) {
      const details = await getPayPalSubscription(subscriptionId);
      const customId = details.custom_id ?? resource?.custom_id;
      const planPaypal = details.plan_id ?? resource?.plan_id ?? "";
      const status = mapPayPalStatus(details.status ?? resource?.status);

      if (!customId?.includes("|")) {
        console.error("[paypal-webhook] missing custom_id", subscriptionId);
        return NextResponse.json({ received: true });
      }

      let userId: string | undefined;
      let catalogPlanId: string | undefined;

      if (customId.startsWith("catalog|") || customId.startsWith("membership|")) {
        const parts = customId.split("|");
        userId = parts[1];
        catalogPlanId = parts[2];
      } else {
        const parts = customId.split("|");
        if (parts.length >= 3) {
          const uid = parts[0];
          const tier = Number.parseInt(parts[1] ?? "", 10);
          const interval = parts[2];
          if (
            uid &&
            [1, 2, 3].includes(tier) &&
            (interval === "monthly" || interval === "annual")
          ) {
            const row = await findMembershipPlanByTierInterval(
              tier,
              interval,
            );
            if (row) {
              userId = uid;
              catalogPlanId = row.plan.id;
            }
          }
        }
      }

      if (!userId || !catalogPlanId) {
        console.error("[paypal-webhook] bad custom_id", customId);
        return NextResponse.json({ received: true });
      }

      const [plan] = await db
        .select()
        .from(subscriptionPlanTable)
        .where(eq(subscriptionPlanTable.id, catalogPlanId))
        .limit(1);

      if (!plan) {
        console.error("[paypal-webhook] plan not found", catalogPlanId);
        return NextResponse.json({ received: true });
      }

      const nextBilling = details.billing_info?.next_billing_time;
      const periodEnd = nextBilling
        ? new Date(nextBilling)
        : new Date(Date.now() + 30 * 86400_000);
      const periodStart = new Date();

      const [existing] = await db
        .select()
        .from(subscriptionInstanceTable)
        .where(eq(subscriptionInstanceTable.paypalSubscriptionId, subscriptionId))
        .limit(1);

      if (existing) {
        await db
          .update(subscriptionInstanceTable)
          .set({
            cancelAtPeriodEnd: status === "canceled",
            currentPeriodEnd: periodEnd,
            currentPeriodStart: periodStart,
            status,
            stripePriceId: planPaypal || existing.stripePriceId,
            updatedAt: new Date(),
          })
          .where(eq(subscriptionInstanceTable.id, existing.id));
      } else if (
        eventType === "BILLING.SUBSCRIPTION.ACTIVATED" ||
        status === "active"
      ) {
        await db.insert(subscriptionInstanceTable).values({
          billingProvider: "paypal",
          cancelAtPeriodEnd: false,
          currentPeriodEnd: periodEnd,
          currentPeriodStart: periodStart,
          id: createId(),
          offerId: plan.offerId,
          paypalSubscriptionId: subscriptionId,
          planId: plan.id,
          status,
          stripeCustomerId: null,
          stripePriceId: planPaypal || "paypal",
          stripeSubscriptionId: null,
          userId,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[paypal-webhook]", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
