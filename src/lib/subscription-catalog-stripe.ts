import type Stripe from "stripe";

import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

import { db } from "~/db";
import { stripeCustomerTable, subscriptionInstanceTable } from "~/db/schema";

/** Returns true if this session was handled (catalog or membership), false otherwise. */
export async function handleCatalogStripeCheckoutSession(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
): Promise<boolean> {
  const kind = session.metadata?.subscriptionKind;
  if (kind !== "catalog" && kind !== "membership") return false;

  const userId = session.metadata?.userId;
  const planId = session.metadata?.subscriptionPlanId;
  const offerId = session.metadata?.offerId;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription as Stripe.Subscription)?.id;

  if (!userId || !planId || !offerId || !subscriptionId) {
    console.error(
      "[subscription-catalog-stripe] checkout.session.completed missing metadata",
      {
        offerId,
        planId,
        subscriptionId,
        userId,
      },
    );
    return true;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price?.id ?? "";
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const [existingCustomer] = await db
    .select()
    .from(stripeCustomerTable)
    .where(eq(stripeCustomerTable.userId, userId))
    .limit(1);

  if (!existingCustomer) {
    await db.insert(stripeCustomerTable).values({
      stripeCustomerId: customerId,
      userId,
    });
  }

  const [existingRow] = await db
    .select()
    .from(subscriptionInstanceTable)
    .where(eq(subscriptionInstanceTable.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (existingRow) {
    await db
      .update(subscriptionInstanceTable)
      .set({
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: new Date(
          (subscription.items.data[0]?.current_period_end ?? 0) * 1000,
        ),
        currentPeriodStart: new Date(
          (subscription.items.data[0]?.current_period_start ?? 0) * 1000,
        ),
        status: subscription.status,
        stripePriceId: priceId,
      })
      .where(eq(subscriptionInstanceTable.id, existingRow.id));
  } else {
    await db.insert(subscriptionInstanceTable).values({
      billingProvider: "stripe",
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: new Date(
        (subscription.items.data[0]?.current_period_end ?? 0) * 1000,
      ),
      currentPeriodStart: new Date(
        (subscription.items.data[0]?.current_period_start ?? 0) * 1000,
      ),
      id: createId(),
      offerId,
      planId,
      status: subscription.status,
      stripeCustomerId: customerId,
      stripePriceId: priceId,
      stripeSubscriptionId: subscriptionId,
      userId,
    });
  }

  return true;
}

/** Returns true if a catalog row was updated. */
export async function syncCatalogStripeSubscription(
  subscription: Stripe.Subscription,
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(subscriptionInstanceTable)
    .where(eq(subscriptionInstanceTable.stripeSubscriptionId, subscription.id))
    .limit(1);

  if (!row) return false;

  const priceId = subscription.items.data[0]?.price?.id ?? row.stripePriceId;

  await db
    .update(subscriptionInstanceTable)
    .set({
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: new Date(
        (subscription.items.data[0]?.current_period_end ?? 0) * 1000,
      ),
      currentPeriodStart: new Date(
        (subscription.items.data[0]?.current_period_start ?? 0) * 1000,
      ),
      status: subscription.status,
      stripePriceId: priceId,
    })
    .where(eq(subscriptionInstanceTable.id, row.id));

  return true;
}

/** When Stripe subscription metadata declares catalog or membership. */
export async function syncCatalogStripeSubscriptionFromMetadata(
  subscription: Stripe.Subscription,
): Promise<boolean> {
  const kind = subscription.metadata?.subscriptionKind;
  if (kind !== "catalog" && kind !== "membership") return false;
  return syncCatalogStripeSubscription(subscription);
}
