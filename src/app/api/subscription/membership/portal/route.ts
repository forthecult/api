/**
 * POST /api/subscription/membership/portal
 *
 * Stripe: Customer Portal session for card / plan changes.
 * PayPal: Returns the account page where users manage automatic payments (no hosted portal API).
 */

import { and, eq, or } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  subscriptionInstanceTable,
  subscriptionOfferTable,
  stripeCustomerTable,
} from "~/db/schema";
import { auth } from "~/lib/auth";
import { MEMBERSHIP_OFFER_SLUG } from "~/lib/membership-subscription-catalog";
import { getStripe } from "~/lib/stripe";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = session.user.id;

  const [row] = await db
    .select({ instance: subscriptionInstanceTable })
    .from(subscriptionInstanceTable)
    .innerJoin(
      subscriptionOfferTable,
      eq(subscriptionInstanceTable.offerId, subscriptionOfferTable.id),
    )
    .where(
      and(
        eq(subscriptionOfferTable.slug, MEMBERSHIP_OFFER_SLUG),
        eq(subscriptionInstanceTable.userId, userId),
        or(
          eq(subscriptionInstanceTable.status, "active"),
          eq(subscriptionInstanceTable.status, "trialing"),
          eq(subscriptionInstanceTable.status, "past_due"),
        ),
      ),
    )
    .limit(1);

  if (row?.instance.billingProvider === "paypal") {
    return NextResponse.json({
      provider: "paypal",
      url: "https://www.paypal.com/myaccount/autopay/",
    });
  }

  const [customerRow] = await db
    .select({ stripeCustomerId: stripeCustomerTable.stripeCustomerId })
    .from(stripeCustomerTable)
    .where(eq(stripeCustomerTable.userId, userId))
    .limit(1);

  if (!customerRow) {
    return NextResponse.json(
      { error: "No subscription found" },
      { status: 404 },
    );
  }

  try {
    const stripe = getStripe();
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerRow.stripeCustomerId,
      return_url: `${baseUrl}/membership`,
    });

    return NextResponse.json({ provider: "stripe", url: portalSession.url });
  } catch (err) {
    console.error("[api/subscription/membership/portal] error:", err);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 },
    );
  }
}
