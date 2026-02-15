import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { orderItemsTable, ordersTable } from "~/db/schema";
import { verifyOrderTrackToken } from "~/lib/order-track-token";

const PAYMENT_WINDOW_MS = 60 * 60 * 1000;

/**
 * GET /api/orders/{orderId}/track?t=token
 * Public order details when t is a valid track token (from POST /api/orders/track).
 * Same response shape as GET /api/orders/{orderId}.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const token = request.nextUrl.searchParams.get("t") ?? "";

    if (!orderId?.trim()) {
      return NextResponse.json(
        { error: { code: "MISSING_ORDER_ID", message: "Order ID required" } },
        { status: 400 },
      );
    }
    if (!verifyOrderTrackToken(orderId.trim(), token)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_OR_EXPIRED",
            message:
              "This link is invalid or has expired. Please look up your order again.",
          },
        },
        { status: 401 },
      );
    }

    const [order] = await db
      .select({
        id: ordersTable.id,
        status: ordersTable.status,
        createdAt: ordersTable.createdAt,
        updatedAt: ordersTable.updatedAt,
        email: ordersTable.email,
        totalCents: ordersTable.totalCents,
        shippingFeeCents: ordersTable.shippingFeeCents,
        shippingName: ordersTable.shippingName,
        shippingAddress1: ordersTable.shippingAddress1,
        shippingAddress2: ordersTable.shippingAddress2,
        shippingCity: ordersTable.shippingCity,
        shippingStateCode: ordersTable.shippingStateCode,
        shippingZip: ordersTable.shippingZip,
        shippingCountryCode: ordersTable.shippingCountryCode,
        shippingPhone: ordersTable.shippingPhone,
        solanaPayDepositAddress: ordersTable.solanaPayDepositAddress,
        // Tracking
        trackingNumber: ordersTable.trackingNumber,
        trackingUrl: ordersTable.trackingUrl,
        trackingCarrier: ordersTable.trackingCarrier,
        shippedAt: ordersTable.shippedAt,
        deliveredAt: ordersTable.deliveredAt,
        estimatedDeliveryFrom: ordersTable.estimatedDeliveryFrom,
        estimatedDeliveryTo: ordersTable.estimatedDeliveryTo,
        trackingEventsJson: ordersTable.trackingEventsJson,
        fulfillmentStatus: ordersTable.fulfillmentStatus,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId.trim()))
      .limit(1);

    if (!order) {
      return NextResponse.json(
        { error: { code: "ORDER_NOT_FOUND", message: "Order not found" } },
        { status: 404 },
      );
    }

    const statusMap: Record<string, string> = {
      pending: "awaiting_payment",
      paid: "paid",
      fulfilled: "shipped",
      cancelled: "cancelled",
    };
    let status = statusMap[order.status] ?? order.status;
    if (order.status === "pending") {
      const expiresAt = order.createdAt.getTime() + PAYMENT_WINDOW_MS;
      if (Date.now() > expiresAt) status = "expired";
    }

    const items = await db
      .select({
        productId: orderItemsTable.productId,
        name: orderItemsTable.name,
        quantity: orderItemsTable.quantity,
        priceCents: orderItemsTable.priceCents,
      })
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, order.id));

    const subtotalCents = items.reduce(
      (sum, i) => sum + i.priceCents * i.quantity,
      0,
    );
    const shippingUsd = (order.shippingFeeCents ?? 0) / 100;
    const subtotalUsd = subtotalCents / 100;
    const totalUsd = order.totalCents / 100;
    const paidAt =
      order.status === "paid" ? order.updatedAt.toISOString() : null;

    // Derive richer status from fulfillment status
    if (order.fulfillmentStatus === "fulfilled" && status === "paid") {
      status = "shipped";
    }
    if (order.deliveredAt) {
      status = "delivered";
    }

    return NextResponse.json({
      orderId: order.id,
      status,
      createdAt: order.createdAt.toISOString(),
      paidAt,
      email: order.email ?? undefined,
      items: items.map((i) => ({
        productId: i.productId,
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
      totals: {
        subtotalUsd,
        shippingUsd,
        totalUsd,
      },
      tracking: order.trackingNumber
        ? {
            trackingNumber: order.trackingNumber,
            trackingUrl: order.trackingUrl ?? undefined,
            carrier: order.trackingCarrier ?? undefined,
            shippedAt: order.shippedAt?.toISOString() ?? undefined,
            deliveredAt: order.deliveredAt?.toISOString() ?? undefined,
            estimatedDeliveryFrom: order.estimatedDeliveryFrom ?? undefined,
            estimatedDeliveryTo: order.estimatedDeliveryTo ?? undefined,
            events: order.trackingEventsJson ?? undefined,
          }
        : undefined,
      payment: order.solanaPayDepositAddress
        ? {
            chain: "solana",
            token: "USDC",
            amountUsd: totalUsd,
            transactionSignature: undefined,
          }
        : undefined,
    });
  } catch (err) {
    console.error("Order track get error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load order" } },
      { status: 500 },
    );
  }
}
