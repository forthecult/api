import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { orderItemsTable, ordersTable } from "~/db/schema";

/**
 * GET /api/orders/by-session?session_id=xxx
 * Returns minimal order details for the thank-you page when redirect has session_id (Stripe).
 * No auth; session_id is unguessable. Used only after successful Stripe redirect.
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.json(
      { error: "session_id required" },
      { status: 400 },
    );
  }

  const [order] = await db
    .select({
      id: ordersTable.id,
      email: ordersTable.email,
      paymentMethod: ordersTable.paymentMethod,
      totalCents: ordersTable.totalCents,
      createdAt: ordersTable.createdAt,
      shippingName: ordersTable.shippingName,
      shippingAddress1: ordersTable.shippingAddress1,
      shippingAddress2: ordersTable.shippingAddress2,
      shippingCity: ordersTable.shippingCity,
      shippingStateCode: ordersTable.shippingStateCode,
      shippingZip: ordersTable.shippingZip,
      shippingCountryCode: ordersTable.shippingCountryCode,
      shippingPhone: ordersTable.shippingPhone,
    })
    .from(ordersTable)
    .where(eq(ordersTable.stripeCheckoutSessionId, sessionId))
    .limit(1);

  if (!order) {
    return NextResponse.json(
      { error: "Order not found or not yet created" },
      { status: 404 },
    );
  }

  const items = await db
    .select({
      name: orderItemsTable.name,
      quantity: orderItemsTable.quantity,
      priceCents: orderItemsTable.priceCents,
    })
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  return NextResponse.json({
    orderId: order.id,
    email: order.email ?? undefined,
    paymentMethod: order.paymentMethod ?? "stripe",
    totalCents: order.totalCents,
    createdAt: order.createdAt.toISOString(),
    items: items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      priceUsd: i.priceCents / 100,
      subtotalUsd: (i.priceCents * i.quantity) / 100,
    })),
    shipping:
      order.shippingName ||
      order.shippingAddress1 ||
      order.shippingCity ||
      order.shippingCountryCode
        ? {
            name: order.shippingName ?? undefined,
            address1: order.shippingAddress1 ?? undefined,
            address2: order.shippingAddress2 ?? undefined,
            city: order.shippingCity ?? undefined,
            stateCode: order.shippingStateCode ?? undefined,
            zip: order.shippingZip ?? undefined,
            countryCode: order.shippingCountryCode ?? undefined,
            phone: order.shippingPhone ?? undefined,
          }
        : undefined,
  });
}
