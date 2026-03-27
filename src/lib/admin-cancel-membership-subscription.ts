import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "~/db";
import {
  subscriptionInstanceTable,
  subscriptionOfferTable,
} from "~/db/schema";
import { cancelPayPalSubscription } from "~/lib/paypal-billing";
import { getStripeIfConfigured } from "~/lib/stripe";
import { MEMBERSHIP_OFFER_SLUG } from "~/lib/membership-subscription-catalog";

/**
 * Admin-only: cancel a membership `subscription_instance` row and the provider
 * subscription when applicable (Stripe / PayPal). Other providers get a DB-only cancel.
 */
export async function adminCancelMembershipSubscription(
  subscriptionInstanceId: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  const [row] = await db
    .select({
      billingProvider: subscriptionInstanceTable.billingProvider,
      id: subscriptionInstanceTable.id,
      offerSlug: subscriptionOfferTable.slug,
      paypalSubscriptionId: subscriptionInstanceTable.paypalSubscriptionId,
      status: subscriptionInstanceTable.status,
      stripeSubscriptionId: subscriptionInstanceTable.stripeSubscriptionId,
    })
    .from(subscriptionInstanceTable)
    .innerJoin(
      subscriptionOfferTable,
      eq(subscriptionInstanceTable.offerId, subscriptionOfferTable.id),
    )
    .where(
      and(
        eq(subscriptionInstanceTable.id, subscriptionInstanceId),
        eq(subscriptionOfferTable.slug, MEMBERSHIP_OFFER_SLUG),
      ),
    )
    .limit(1);

  if (!row) {
    return { error: "Subscription not found", status: 404 };
  }

  if (row.status === "canceled" || row.status === "cancelled") {
    return { error: "Already canceled", status: 409 };
  }

  const provider = row.billingProvider.toLowerCase();

  try {
    if (provider === "stripe" && row.stripeSubscriptionId) {
      const stripe = getStripeIfConfigured();
      if (!stripe) {
        return { error: "Stripe is not configured", status: 503 };
      }
      await stripe.subscriptions.cancel(row.stripeSubscriptionId);
    } else if (provider === "paypal" && row.paypalSubscriptionId) {
      await cancelPayPalSubscription(row.paypalSubscriptionId);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg, status: 502 };
  }

  const now = new Date();
  await db
    .update(subscriptionInstanceTable)
    .set({
      cancelAtPeriodEnd: false,
      status: "canceled",
      updatedAt: now,
    })
    .where(eq(subscriptionInstanceTable.id, row.id));

  return { ok: true };
}
