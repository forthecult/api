import type Stripe from "stripe";

import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { affiliateTable, orderItemsTable, ordersTable } from "~/db/schema";
import { resolveAffiliateForOrder } from "~/lib/affiliate";
import { onOrderCreated } from "~/lib/create-user-notification";
import { fulfillEsimOrder, hasEsimItems } from "~/lib/esim-fulfillment";
import {
  createAndConfirmPrintfulOrder,
  hasPrintfulItems,
} from "~/lib/printful-orders";
import {
  createAndConfirmPrintifyOrder,
  hasPrintifyItems,
} from "~/lib/printify-orders";
import { getStripe, getStripeWebhookSecret } from "~/lib/stripe";

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

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orderId = paymentIntent.metadata?.orderId;
      if (!orderId || typeof orderId !== "string") {
        console.error(
          "Webhook payment_intent.succeeded: missing metadata.orderId",
        );
        return NextResponse.json({ received: true });
      }

      const [order] = await db
        .select({ id: ordersTable.id, status: ordersTable.status })
        .from(ordersTable)
        .where(eq(ordersTable.id, orderId))
        .limit(1);

      if (!order) {
        console.error(
          "Webhook payment_intent.succeeded: order not found",
          orderId,
        );
        return NextResponse.json({ received: true });
      }
      if (order.status === "paid") {
        return NextResponse.json({ duplicate: true, received: true });
      }

      await db
        .update(ordersTable)
        .set({
          paymentStatus: "paid",
          status: "paid",
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, orderId));

      const now = new Date();
      const [updatedOrder] = await db
        .select({
          affiliateCode: ordersTable.affiliateCode,
          affiliateCommissionCents: ordersTable.affiliateCommissionCents,
          affiliateDiscountCents: ordersTable.affiliateDiscountCents,
          affiliateId: ordersTable.affiliateId,
        })
        .from(ordersTable)
        .where(eq(ordersTable.id, orderId))
        .limit(1);

      if (
        updatedOrder?.affiliateId &&
        updatedOrder.affiliateCommissionCents != null
      ) {
        const [row] = await db
          .select({ totalEarnedCents: affiliateTable.totalEarnedCents })
          .from(affiliateTable)
          .where(eq(affiliateTable.id, updatedOrder.affiliateId))
          .limit(1);
        const current = row?.totalEarnedCents ?? 0;
        await db
          .update(affiliateTable)
          .set({
            totalEarnedCents:
              current + (updatedOrder.affiliateCommissionCents ?? 0),
            updatedAt: now,
          })
          .where(eq(affiliateTable.id, updatedOrder.affiliateId));
      }

      void onOrderCreated(orderId);

      try {
        const hasPrintful = await hasPrintfulItems(orderId);
        if (hasPrintful) {
          const printfulResult = await createAndConfirmPrintfulOrder(orderId);
          if (!printfulResult.success) {
            console.error("Printful order failed:", printfulResult.error);
          }
        }
      } catch (pfError) {
        console.error("Error processing Printful order:", pfError);
      }

      try {
        const hasPrintify = await hasPrintifyItems(orderId);
        if (hasPrintify) {
          const printifyResult = await createAndConfirmPrintifyOrder(orderId);
          if (!printifyResult.success) {
            console.error("Printify order failed:", printifyResult.error);
          }
        }
      } catch (pyError) {
        console.error("Error processing Printify order:", pyError);
      }

      try {
        const hasEsim = await hasEsimItems(orderId);
        if (hasEsim) {
          const esimResult = await fulfillEsimOrder(orderId);
          if (!esimResult.success) {
            console.error("eSIM fulfillment failed:", esimResult.error);
          }
        }
      } catch (esimError) {
        console.error("Error processing eSIM order:", esimError);
      }

      return NextResponse.json({ orderId, received: true });
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

    interface OrderItemMeta {
      name: string;
      priceCents: number;
      productId: string;
      productVariantId?: string;
      quantity: number;
    }
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
      typeof affiliateCodeFromMeta === "string"
        ? affiliateCodeFromMeta
        : undefined,
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

    // Check for existing order (eSIM orders are pre-created; regular orders are not)
    const [existingOrder] = await db
      .select({
        id: ordersTable.id,
        paymentStatus: ordersTable.paymentStatus,
        status: ordersTable.status,
      })
      .from(ordersTable)
      .where(eq(ordersTable.stripeCheckoutSessionId, session.id))
      .limit(1);

    if (existingOrder) {
      // If already paid, this is a duplicate webhook — skip
      if (existingOrder.paymentStatus === "paid") {
        return NextResponse.json({ duplicate: true, received: true });
      }

      // Pre-created order (e.g. eSIM) — update status to paid and run fulfillment
      await db
        .update(ordersTable)
        .set({
          paymentStatus: "paid",
          status: "paid",
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, existingOrder.id));

      void onOrderCreated(existingOrder.id);

      // Run eSIM fulfillment for pre-created orders
      try {
        const hasEsim = await hasEsimItems(existingOrder.id);
        if (hasEsim) {
          console.log(
            `Stripe checkout for pre-created order ${existingOrder.id} has eSIM items, provisioning...`,
          );
          const esimResult = await fulfillEsimOrder(existingOrder.id);
          if (esimResult.success) {
            console.log(`eSIM provisioned for order ${existingOrder.id}`);
          } else {
            console.error(`Failed to provision eSIM: ${esimResult.error}`);
          }
        }
      } catch (esimError) {
        console.error("Error processing eSIM order:", esimError);
      }

      return NextResponse.json({ orderId: existingOrder.id, received: true });
    }

    await db.insert(ordersTable).values({
      createdAt: now,
      email,
      fulfillmentStatus: "unfulfilled",
      id: orderId,
      paymentMethod: "stripe",
      paymentStatus: "paid",
      status: "paid",
      stripeCheckoutSessionId: session.id,
      totalCents,
      updatedAt: now,
      userId,
      ...shippingFromSession,
      ...(affiliateResult && {
        affiliateCode: affiliateResult.affiliate.affiliateCode,
        affiliateCommissionCents: affiliateResult.affiliate.commissionCents,
        affiliateDiscountCents: affiliateResult.affiliate.discountCents,
        affiliateId: affiliateResult.affiliate.affiliateId,
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
          totalEarnedCents: current + affiliateResult.affiliate.commissionCents,
          updatedAt: now,
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

    // Provision eSIM if order contains eSIM items
    try {
      const hasEsim = await hasEsimItems(orderId);
      if (hasEsim) {
        console.log(
          `Stripe order ${orderId} has eSIM items, provisioning eSIM...`,
        );
        const esimResult = await fulfillEsimOrder(orderId);
        if (esimResult.success) {
          console.log(`eSIM provisioned for order ${orderId}`);
        } else {
          console.error(`Failed to provision eSIM: ${esimResult.error}`);
        }
      }
    } catch (esimError) {
      console.error("Error processing eSIM order:", esimError);
      // Don't fail the webhook - order is created, eSIM can be retried
    }

    return NextResponse.json({ orderId, received: true });
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
