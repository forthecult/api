/**
 * POST /api/membership/subscription-webhook
 *
 * Stripe webhook for subscription catalog + membership (both use `subscription_instance`).
 * Handles: checkout.session.completed, customer.subscription.updated,
 * customer.subscription.deleted, invoice.payment_failed
 *
 * Configure this endpoint in Stripe Dashboard -> Webhooks with these events.
 * Uses STRIPE_SUBSCRIPTION_WEBHOOK_SECRET (separate from the order webhook).
 */

import type Stripe from "stripe";

import { type NextRequest, NextResponse } from "next/server";

import {
  handleCatalogStripeCheckoutSession,
  syncCatalogStripeSubscription,
  syncCatalogStripeSubscriptionFromMetadata,
} from "~/lib/subscription-catalog-stripe";
import { getStripe } from "~/lib/stripe";

const webhookSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Subscription webhook not configured" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature" },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const handled = await handleCatalogStripeCheckoutSession(session, stripe);
        if (!handled) {
          console.error(
            "[subscription-webhook] checkout.session.completed: unhandled subscription session",
            { mode: session.mode, subscriptionKind: session.metadata?.subscriptionKind },
          );
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoiceAny = invoice as any;
        const subscriptionId: null | string =
          typeof invoiceAny.subscription === "string"
            ? invoiceAny.subscription
            : typeof invoiceAny.parent?.subscription_details?.subscription === "string"
              ? invoiceAny.parent.subscription_details.subscription
              : null;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscription(sub);
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[subscription-webhook] handler error:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const fromMeta = await syncCatalogStripeSubscriptionFromMetadata(subscription);
  if (fromMeta) return;
  await syncCatalogStripeSubscription(subscription);
}
