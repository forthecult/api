/**
 * POST /api/subscribe/membership
 *
 * Starts recurring membership checkout via catalog plans (`subscription_offer` slug `membership`).
 * Body: { tierId: 1|2|3, interval: "monthly"|"annual", provider?: "stripe"|"paypal" }
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { stripeCustomerTable } from "~/db/schema";
import { auth } from "~/lib/auth";
import { findMembershipPlanByTierInterval } from "~/lib/membership-subscription-catalog";
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
    interval?: string;
    provider?: "paypal" | "stripe";
    tierId?: number;
  };

  const tier = body.tierId;
  const interval = body.interval as "annual" | "monthly" | undefined;
  const provider = body.provider ?? "stripe";

  if (!tier || ![1, 2, 3].includes(tier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }
  if (!interval || !["annual", "monthly"].includes(interval)) {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }
  if (provider !== "stripe" && provider !== "paypal") {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const row = await findMembershipPlanByTierInterval(tier, interval);
  if (!row) {
    return NextResponse.json({ error: "Plan not found" }, { status: 400 });
  }

  const { offer, plan } = row;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  const userId = session.user.id;

  if (provider === "paypal") {
    if (!plan.payPaypal || !plan.paypalPlanId) {
      return NextResponse.json(
        {
          error:
            "Card billing via PayPal is not configured. Set PAYPAL_PLAN_* env vars.",
        },
        { status: 503 },
      );
    }
    try {
      const customId = `membership|${userId}|${plan.id}`;
      const { approvalUrl } = await createPayPalSubscription({
        cancelUrl: `${baseUrl}/membership?subscription=cancelled`,
        customId,
        email: session.user.email,
        planId: plan.paypalPlanId,
        returnUrl: `${baseUrl}/membership?subscription=success`,
      });
      return NextResponse.json({ provider: "paypal", url: approvalUrl });
    } catch (err) {
      console.error("[api/subscribe/membership] PayPal error:", err);
      if (
        err instanceof Error &&
        (err.message.includes("PAYPAL_") || err.message.includes("not set"))
      ) {
        return NextResponse.json(
          { error: "PayPal not configured" },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: "Failed to start PayPal subscription" },
        { status: 500 },
      );
    }
  }

  const priceId = plan.stripePriceId;
  if (!priceId) {
    return NextResponse.json(
      {
        error:
          "This membership plan is not available for checkout right now. Please try again later or contact support.",
      },
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

    const meta = {
      offerId: offer.id,
      subscriptionKind: "membership" as const,
      subscriptionPlanId: plan.id,
      userId,
    };

    const checkoutSession = await stripe.checkout.sessions.create({
      allow_promotion_codes: true,
      cancel_url: `${baseUrl}/membership?subscription=cancelled`,
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: meta,
      mode: "subscription",
      subscription_data: {
        metadata: meta,
      },
      success_url: `${baseUrl}/membership?subscription=success`,
    });

    return NextResponse.json({
      provider: "stripe",
      url: checkoutSession.url,
    });
  } catch (err) {
    console.error("[api/subscribe/membership] error:", err);
    if (
      err instanceof Error &&
      (err.message.includes("STRIPE_") || err.message.includes("not set"))
    ) {
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
