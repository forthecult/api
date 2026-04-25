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
        createdAt: ordersTable.createdAt,
        deliveredAt: ordersTable.deliveredAt,
        email: ordersTable.email,
        estimatedDeliveryFrom: ordersTable.estimatedDeliveryFrom,
        estimatedDeliveryTo: ordersTable.estimatedDeliveryTo,
        fulfillmentStatus: ordersTable.fulfillmentStatus,
        id: ordersTable.id,
        shippedAt: ordersTable.shippedAt,
        shippingAddress1: ordersTable.shippingAddress1,
        shippingAddress2: ordersTable.shippingAddress2,
        shippingCity: ordersTable.shippingCity,
        shippingCountryCode: ordersTable.shippingCountryCode,
        shippingFeeCents: ordersTable.shippingFeeCents,
        shippingName: ordersTable.shippingName,
        shippingPhone: ordersTable.shippingPhone,
        shippingStateCode: ordersTable.shippingStateCode,
        shippingZip: ordersTable.shippingZip,
        solanaPayDepositAddress: ordersTable.solanaPayDepositAddress,
        status: ordersTable.status,
        totalCents: ordersTable.totalCents,
        trackingCarrier: ordersTable.trackingCarrier,
        trackingEventsJson: ordersTable.trackingEventsJson,
        // Tracking
        trackingNumber: ordersTable.trackingNumber,
        trackingUrl: ordersTable.trackingUrl,
        updatedAt: ordersTable.updatedAt,
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
      cancelled: "cancelled",
      fulfilled: "shipped",
      paid: "paid",
      pending: "awaiting_payment",
    };
    let status = statusMap[order.status] ?? order.status;
    if (order.status === "pending") {
      const expiresAt = order.createdAt.getTime() + PAYMENT_WINDOW_MS;
      if (Date.now() > expiresAt) status = "expired";
    }

    const items = await db
      .select({
        name: orderItemsTable.name,
        priceCents: orderItemsTable.priceCents,
        productId: orderItemsTable.productId,
        quantity: orderItemsTable.quantity,
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
      createdAt: order.createdAt.toISOString(),
      email: order.email ?? undefined,
      items: items.map((i) => ({
        name: i.name,
        priceUsd: i.priceCents / 100,
        productId: i.productId,
        quantity: i.quantity,
        subtotalUsd: (i.priceCents * i.quantity) / 100,
      })),
      orderId: order.id,
      paidAt,
      payment: order.solanaPayDepositAddress
        ? {
            amountUsd: totalUsd,
            chain: "solana",
            token: "USDC",
            transactionSignature: undefined,
          }
        : undefined,
      shipping:
        order.shippingName ||
        order.shippingAddress1 ||
        order.shippingCity ||
        order.shippingCountryCode
          ? {
              address1: order.shippingAddress1 ?? undefined,
              address2: order.shippingAddress2 ?? undefined,
              city: order.shippingCity ?? undefined,
              countryCode: order.shippingCountryCode ?? undefined,
              name: order.shippingName ?? undefined,
              phone: order.shippingPhone ?? undefined,
              stateCode: order.shippingStateCode ?? undefined,
              zip: order.shippingZip ?? undefined,
            }
          : undefined,
      status,
      totals: {
        shippingUsd,
        subtotalUsd,
        totalUsd,
      },
      tracking: order.trackingNumber
        ? {
            carrier: order.trackingCarrier ?? undefined,
            deliveredAt: order.deliveredAt?.toISOString() ?? undefined,
            estimatedDeliveryFrom: order.estimatedDeliveryFrom ?? undefined,
            estimatedDeliveryTo: order.estimatedDeliveryTo ?? undefined,
            events: order.trackingEventsJson ?? undefined,
            shippedAt: order.shippedAt?.toISOString() ?? undefined,
            trackingNumber: order.trackingNumber,
            trackingUrl: order.trackingUrl ?? undefined,
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
