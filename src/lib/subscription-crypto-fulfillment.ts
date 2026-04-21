import { createId } from "@paralleldrive/cuid2";
import { and, eq, or } from "drizzle-orm";

import { db } from "~/db";
import {
  ordersTable,
  subscriptionInstanceTable,
  subscriptionPlanTable,
} from "~/db/schema";

import { addBillingPeriod } from "./subscription-period";

/**
 * After a crypto order is marked paid, attach or extend catalog subscription access.
 */
export async function fulfillSubscriptionCryptoOrder(
  orderId: string,
): Promise<void> {
  const [order] = await db
    .select({
      id: ordersTable.id,
      subscriptionPlanId: ordersTable.subscriptionPlanId,
      userId: ordersTable.userId,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);

  if (!order?.subscriptionPlanId || !order.userId) return;

  const [plan] = await db
    .select()
    .from(subscriptionPlanTable)
    .where(eq(subscriptionPlanTable.id, order.subscriptionPlanId))
    .limit(1);

  if (!plan) return;

  const [existing] = await db
    .select()
    .from(subscriptionInstanceTable)
    .where(
      and(
        eq(subscriptionInstanceTable.userId, order.userId),
        eq(subscriptionInstanceTable.planId, plan.id),
        or(
          eq(subscriptionInstanceTable.status, "active"),
          eq(subscriptionInstanceTable.status, "past_due"),
        ),
      ),
    )
    .limit(1);

  const now = new Date();

  if (existing) {
    const base =
      existing.currentPeriodEnd > now ? existing.currentPeriodEnd : now;
    const newEnd = addBillingPeriod(
      base,
      plan.intervalUnit,
      plan.intervalCount,
    );
    await db
      .update(subscriptionInstanceTable)
      .set({
        currentPeriodEnd: newEnd,
        currentPeriodStart: existing.currentPeriodStart,
        lastOrderId: orderId,
        status: "active",
        updatedAt: now,
      })
      .where(eq(subscriptionInstanceTable.id, existing.id));
    return;
  }

  const periodEnd = addBillingPeriod(
    now,
    plan.intervalUnit,
    plan.intervalCount,
  );

  await db.insert(subscriptionInstanceTable).values({
    billingProvider: "crypto_manual",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: periodEnd,
    currentPeriodStart: now,
    id: createId(),
    lastOrderId: orderId,
    offerId: plan.offerId,
    planId: plan.id,
    status: "active",
    userId: order.userId,
  });
}
