/**
 * POST /api/subscriptions/checkout
 *
 * Starts a subscription for any catalog plan: Stripe, PayPal, or manual crypto renewal flow.
 * Body: { planId: string, provider: "stripe" | "paypal" | "crypto_manual" }
 */

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  stripeCustomerTable,
  subscriptionOfferTable,
  subscriptionPlanTable,
} from "~/db/schema";
import { auth } from "~/lib/auth";
import { createPayPalSubscription } from "~/lib/paypal-billing";
import { getStripe } from "~/lib/stripe";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json(
      { error: "Sign in to subscribe" },
      { status: 401 },
    );
  }

  const body = (await request.json()) as {
    planId?: string;
    provider?: "crypto_manual" | "paypal" | "stripe";
  };

  const planId = body.planId?.trim();
  const provider = body.provider;
  if (!planId) {
    return NextResponse.json({ error: "planId required" }, { status: 400 });
  }
  if (
    provider !== "stripe" &&
    provider !== "paypal" &&
    provider !== "crypto_manual"
  ) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

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
        eq(subscriptionPlanTable.id, planId),
        eq(subscriptionPlanTable.published, true),
        eq(subscriptionOfferTable.published, true),
      ),
    )
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const { offer, plan } = row;
  const userId = session.user.id;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  if (provider === "crypto_manual") {
    if (!plan.payCryptoManual || !plan.cryptoProductId) {
      return NextResponse.json(
        {
          error:
            "Crypto subscription not enabled for this plan (set crypto product + pay flag in admin).",
        },
        { status: 400 },
      );
    }
    return NextResponse.json({
      crypto: {
        checkoutHint:
          "POST /api/checkout with subscriptionPlanId set to this plan id, signed-in user, and items matching the plan crypto product.",
        cryptoProductId: plan.cryptoProductId,
        subscriptionPlanId: plan.id,
      },
      manualRenewal: true,
      provider: "crypto_manual",
    });
  }

  if (provider === "paypal") {
    if (!plan.payPaypal || !plan.paypalPlanId) {
      return NextResponse.json(
        { error: "PayPal not configured for this plan" },
        { status: 503 },
      );
    }
    try {
      const customId = `catalog|${userId}|${plan.id}`;
      const { approvalUrl } = await createPayPalSubscription({
        cancelUrl: `${baseUrl}/?catalog_checkout=cancel`,
        customId,
        email: session.user.email,
        planId: plan.paypalPlanId,
        returnUrl: `${baseUrl}/?catalog_checkout=success`,
      });
      return NextResponse.json({ provider: "paypal", url: approvalUrl });
    } catch (err) {
      console.error("[subscriptions/checkout] PayPal", err);
      return NextResponse.json(
        { error: "Failed to start PayPal subscription" },
        { status: 500 },
      );
    }
  }

  if (!plan.payStripe || !plan.stripePriceId) {
    return NextResponse.json(
      { error: "Stripe not configured for this plan" },
      { status: 503 },
    );
  }

  try {
    const stripe = getStripe();

    let stripeCustomerId: string;
    const [existing] = await db
      .select({ stripeCustomerId: stripeCustomerTable.stripeCustomerId })
      .from(stripeCustomerTable)
      .where(eq(stripeCustomerTable.userId, userId))
      .limit(1);

    if (existing) {
      stripeCustomerId = existing.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({
        email: session.user.email,
        metadata: { userId },
      });
      stripeCustomerId = customer.id;
      await db.insert(stripeCustomerTable).values({
        stripeCustomerId: customer.id,
        userId,
      });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      cancel_url: `${baseUrl}/?catalog_checkout=cancel`,
      customer: stripeCustomerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      metadata: {
        offerId: offer.id,
        subscriptionKind: "catalog",
        subscriptionPlanId: plan.id,
        userId,
      },
      mode: "subscription",
      subscription_data: {
        metadata: {
          offerId: offer.id,
          subscriptionKind: "catalog",
          subscriptionPlanId: plan.id,
          userId,
        },
      },
      success_url: `${baseUrl}/?catalog_checkout=success`,
    });

    return NextResponse.json({
      provider: "stripe",
      url: checkoutSession.url,
    });
  } catch (err) {
    console.error("[subscriptions/checkout] Stripe", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
