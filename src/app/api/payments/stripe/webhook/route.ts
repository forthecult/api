import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { db } from "~/db";
import { affiliateTable, orderItemsTable, ordersTable } from "~/db/schema";
import { resolveAffiliateForOrder } from "~/lib/affiliate";
import { onOrderCreated } from "~/lib/create-user-notification";
import { getStripe, getStripeWebhookSecret } from "~/lib/stripe";
import {
  createAndConfirmPrintfulOrder,
  hasPrintfulItems,
} from "~/lib/printful-orders";
import {
  createAndConfirmPrintifyOrder,
  hasPrintifyItems,
} from "~/lib/printify-orders";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature" },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const webhookSecret = getStripeWebhookSecret();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid signature";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const orderItemsJson = session.metadata?.orderItems;
    if (!orderItemsJson) {
      console.error(
        "Webhook checkout.session.completed: missing metadata.orderItems",
      );
      return NextResponse.json(
        { error: "Missing order metadata" },
        { status: 400 },
      );
    }

    type OrderItemMeta = {
      productId: string;
      productVariantId?: string;
      name: string;
      priceCents: number;
      quantity: number;
    };
    let orderItems: OrderItemMeta[];
    try {
      orderItems = JSON.parse(orderItemsJson) as OrderItemMeta[];
    } catch {
      return NextResponse.json(
        { error: "Invalid order metadata" },
        { status: 400 },
      );
    }

    if (orderItems.length === 0) {
      return NextResponse.json({ error: "Empty order items" }, { status: 400 });
    }

    const subtotalCents = orderItems.reduce(
      (sum, i) => sum + i.priceCents * i.quantity,
      0,
    );
    const affiliateCodeFromMeta = session.metadata?.affiliateCode;
    const affiliateResult = await resolveAffiliateForOrder(
      typeof affiliateCodeFromMeta === "string" ? affiliateCodeFromMeta : undefined,
      subtotalCents,
      0,
    );
    const totalCents =
      affiliateResult?.totalAfterDiscountCents ?? subtotalCents;

    const email =
      session.customer_email ??
      session.customer_details?.email ??
      "guest@checkout.local";
    const now = new Date();
    const orderId = createId();
    const userIdFromMeta = session.metadata?.userId;
    const userId =
      typeof userIdFromMeta === "string" && userIdFromMeta
        ? userIdFromMeta
        : null;

    // Shipping/customer address from Stripe Checkout (when collection enabled)
    const addr = session.customer_details?.address;
    const shippingFromSession =
      session.customer_details?.name ||
      addr?.line1 ||
      addr?.city ||
      addr?.country
        ? {
            ...(session.customer_details?.name && {
              shippingName: session.customer_details.name,
            }),
            ...(addr?.line1 && { shippingAddress1: addr.line1 }),
            ...(addr?.line2 && { shippingAddress2: addr.line2 }),
            ...(addr?.city && { shippingCity: addr.city }),
            ...(addr?.state && { shippingStateCode: addr.state }),
            ...(addr?.postal_code && { shippingZip: addr.postal_code }),
            ...(addr?.country && { shippingCountryCode: addr.country }),
            ...(session.customer_details?.phone && {
              shippingPhone: session.customer_details.phone,
            }),
          }
        : {};

    await db.insert(ordersTable).values({
      id: orderId,
      createdAt: now,
      email,
      fulfillmentStatus: "unfulfilled",
      paymentMethod: "stripe",
      paymentStatus: "paid",
      status: "paid",
      stripeCheckoutSessionId: session.id,
      totalCents,
      updatedAt: now,
      userId,
      ...shippingFromSession,
      ...(affiliateResult && {
        affiliateId: affiliateResult.affiliate.affiliateId,
        affiliateCode: affiliateResult.affiliate.affiliateCode,
        affiliateCommissionCents: affiliateResult.affiliate.commissionCents,
        affiliateDiscountCents: affiliateResult.affiliate.discountCents,
      }),
    });

    if (orderItems.length > 0) {
      await db.insert(orderItemsTable).values(
        orderItems.map((item) => ({
          id: createId(),
          name: item.name,
          orderId,
          priceCents: item.priceCents,
          productId: item.productId,
          productVariantId: item.productVariantId ?? null,
          quantity: item.quantity,
        })),
      );
    }

    if (affiliateResult) {
      const [row] = await db
        .select({ totalEarnedCents: affiliateTable.totalEarnedCents })
        .from(affiliateTable)
        .where(eq(affiliateTable.id, affiliateResult.affiliate.affiliateId))
        .limit(1);
      const current = row?.totalEarnedCents ?? 0;
      await db
        .update(affiliateTable)
        .set({
          updatedAt: now,
          totalEarnedCents: current + affiliateResult.affiliate.commissionCents,
        })
        .where(eq(affiliateTable.id, affiliateResult.affiliate.affiliateId));
    }

    void onOrderCreated(orderId);

    // Send to Printful if order contains Printful items
    try {
      const hasPrintful = await hasPrintfulItems(orderId);
      if (hasPrintful) {
        console.log(
          `Stripe order ${orderId} has Printful items, creating Printful order...`,
        );
        const printfulResult = await createAndConfirmPrintfulOrder(orderId);
        if (printfulResult.success) {
          console.log(
            `Printful order created: ${printfulResult.printfulOrderId}`,
          );
        } else {
          console.error(
            `Failed to create Printful order: ${printfulResult.error}`,
          );
        }
      }
    } catch (pfError) {
      console.error("Error processing Printful order:", pfError);
      // Don't fail the webhook - order is created, Printful can be retried
    }

    // Send to Printify if order contains Printify items
    try {
      const hasPrintify = await hasPrintifyItems(orderId);
      if (hasPrintify) {
        console.log(
          `Stripe order ${orderId} has Printify items, creating Printify order...`,
        );
        const printifyResult = await createAndConfirmPrintifyOrder(orderId);
        if (printifyResult.success) {
          console.log(
            `Printify order created: ${printifyResult.printifyOrderId}`,
          );
        } else {
          console.error(
            `Failed to create Printify order: ${printifyResult.error}`,
          );
        }
      }
    } catch (pyError) {
      console.error("Error processing Printify order:", pyError);
      // Don't fail the webhook - order is created, Printify can be retried
    }

    return NextResponse.json({ received: true, orderId });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes("STRIPE_") || err.message.includes("not set"))
    ) {
      return NextResponse.json(
        { error: "Stripe webhook not configured" },
        { status: 503 },
      );
    }
    console.error("Stripe webhook error:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
