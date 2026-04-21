import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { orderItemsTable, ordersTable } from "~/db/schema";
import { getMoltbookAgentFromRequest } from "~/lib/moltbook-auth";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

const STATUS_MAP: Record<string, string> = {
  cancelled: "cancelled",
  delivered: "delivered",
  fulfilled: "shipped",
  paid: "paid",
  pending: "awaiting_payment",
  processing: "processing",
  shipped: "shipped",
};

/**
 * GET /api/agent/me/orders/{orderId}
 *
 * Returns full order details for an order belonging to the authenticated Moltbook agent.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(
    `agent:me/orders/detail:${ip}`,
    RATE_LIMITS.api,
  );
  if (!rl.success) return rateLimitResponse(rl, RATE_LIMITS.api.limit);

  const result = await getMoltbookAgentFromRequest(request);
  if ("error" in result) return result.error;

  const { orderId } = await params;
  if (!orderId?.trim()) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const [order] = await db
    .select({
      createdAt: ordersTable.createdAt,
      email: ordersTable.email,
      id: ordersTable.id,
      moltbookAgentId: ordersTable.moltbookAgentId,
      paymentStatus: ordersTable.paymentStatus,
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
      updatedAt: ordersTable.updatedAt,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId.trim()))
    .limit(1);

  if (!order || order.moltbookAgentId !== result.agent.id) {
    return NextResponse.json(
      { error: "Order not found or not owned by this agent" },
      { status: 404 },
    );
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

  const status = STATUS_MAP[order.status] ?? order.status;
  const subtotalCents = items.reduce(
    (sum, i) => sum + i.priceCents * i.quantity,
    0,
  );
  const shippingUsd = (order.shippingFeeCents ?? 0) / 100;
  const totalUsd = order.totalCents / 100;

  return NextResponse.json(
    {
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
      paidAt:
        order.status === "paid" || order.paymentStatus === "paid"
          ? order.updatedAt.toISOString()
          : null,
      paymentMethod: order.solanaPayDepositAddress ? "solana_pay" : undefined,
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
      statusUrl: `${`${process.env.NEXT_PUBLIC_AGENT_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://forthecult.store"}`.replace(
        /\/$/,
        "",
      )}/api/orders/${order.id}/status`,
      totals: {
        shippingUsd,
        subtotalUsd: subtotalCents / 100,
        totalUsd,
      },
    },
    { headers: getRateLimitHeaders(rl, RATE_LIMITS.api.limit) },
  );
}
