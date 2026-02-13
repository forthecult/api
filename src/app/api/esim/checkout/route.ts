import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getCurrentUser } from "~/lib/auth";
import { db } from "~/db";
import { esimOrdersTable, ordersTable } from "~/db/schema";
import { getStripe } from "~/lib/stripe";

type CheckoutBody = {
  orderId: string;
  paymentMethod?: "card" | "paypal";
};

/**
 * POST /api/esim/checkout
 *
 * Creates a Stripe Checkout session for an existing eSIM order.
 * No auth required: if the order has a userId, only that user can checkout;
 * otherwise (guest order) anyone with the orderId can proceed.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const body = (await request.json()) as CheckoutBody;
    const { orderId, paymentMethod } = body;

    if (!orderId) {
      return NextResponse.json(
        { status: false, message: "orderId is required" },
        { status: 400 },
      );
    }

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) {
      return NextResponse.json(
        { status: false, message: "Order not found" },
        { status: 404 },
      );
    }

    // If order is tied to a user, only that user can checkout
    if (order.userId != null && user?.id !== order.userId) {
      return NextResponse.json(
        { status: false, message: "Order not found" },
        { status: 404 },
      );
    }

    if (order.paymentStatus === "paid") {
      return NextResponse.json(
        { status: false, message: "Order is already paid" },
        { status: 400 },
      );
    }

    // Get the eSIM order details for the line item description
    const [esimOrder] = await db
      .select()
      .from(esimOrdersTable)
      .where(eq(esimOrdersTable.orderId, orderId))
      .limit(1);

    if (!esimOrder) {
      return NextResponse.json(
        { status: false, message: "eSIM order not found" },
        { status: 404 },
      );
    }

    const stripe = getStripe();
    const baseUrl =
      process.env.NEXT_SERVER_APP_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";

    // Build line item description
    const description = [
      `${esimOrder.dataQuantity} ${esimOrder.dataUnit}`,
      `${esimOrder.validityDays} days`,
      esimOrder.countryName,
      esimOrder.packageType,
    ]
      .filter(Boolean)
      .join(" · ");

    const checkoutSession = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `eSIM: ${esimOrder.packageName}`,
              description,
            },
            unit_amount: esimOrder.priceCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/dashboard/esim?purchased=${orderId}`,
      cancel_url: `${baseUrl}/esim/${esimOrder.packageId}`,
      // Digital product — don't collect shipping or phone.
      // Stripe still collects email + card billing by default.
      billing_address_collection: "auto",
      shipping_address_collection: undefined,
      phone_number_collection: { enabled: false },
      metadata: {
        orderId,
        esimOrderId: esimOrder.id,
        ...(user?.id ? { userId: user.id } : {}),
        isEsim: "true",
        orderItems: JSON.stringify([
          {
            productId: `esim_${esimOrder.packageId}`,
            name: `eSIM: ${esimOrder.packageName}`,
            priceCents: esimOrder.priceCents,
            quantity: 1,
          },
        ]),
      },
      ...(paymentMethod === "paypal"
        ? { payment_method_types: ["paypal"] as const }
        : {}),
    });

    // Store the Stripe session ID on the order
    await db
      .update(ordersTable)
      .set({
        stripeCheckoutSessionId: checkoutSession.id,
        updatedAt: new Date(),
      })
      .where(eq(ordersTable.id, orderId));

    return NextResponse.json({
      status: true,
      data: {
        checkoutUrl: checkoutSession.url,
        sessionId: checkoutSession.id,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json(
        { status: false, message: "Stripe is not configured" },
        { status: 503 },
      );
    }
    console.error("eSIM checkout error:", err);
    return NextResponse.json(
      { status: false, message: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
