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
  pending: "awaiting_payment",
  paid: "paid",
  processing: "processing",
  fulfilled: "shipped",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
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
  const rl = await checkRateLimit(`agent:me/orders/detail:${ip}`, RATE_LIMITS.api);
  if (!rl.success) return rateLimitResponse(rl, RATE_LIMITS.api.limit);

  const result = await getMoltbookAgentFromRequest(request);
  if ("error" in result) return result.error;

  const { orderId } = await params;
  if (!orderId?.trim()) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const [order] = await db
    .select({
      id: ordersTable.id,
      status: ordersTable.status,
      paymentStatus: ordersTable.paymentStatus,
      totalCents: ordersTable.totalCents,
      shippingFeeCents: ordersTable.shippingFeeCents,
      createdAt: ordersTable.createdAt,
      updatedAt: ordersTable.updatedAt,
      email: ordersTable.email,
      moltbookAgentId: ordersTable.moltbookAgentId,
      shippingName: ordersTable.shippingName,
      shippingAddress1: ordersTable.shippingAddress1,
      shippingAddress2: ordersTable.shippingAddress2,
      shippingCity: ordersTable.shippingCity,
      shippingStateCode: ordersTable.shippingStateCode,
      shippingZip: ordersTable.shippingZip,
      shippingCountryCode: ordersTable.shippingCountryCode,
      shippingPhone: ordersTable.shippingPhone,
      solanaPayDepositAddress: ordersTable.solanaPayDepositAddress,
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
      productId: orderItemsTable.productId,
      name: orderItemsTable.name,
      quantity: orderItemsTable.quantity,
      priceCents: orderItemsTable.priceCents,
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
      orderId: order.id,
      status,
    createdAt: order.createdAt.toISOString(),
    paidAt:
      order.status === "paid" || order.paymentStatus === "paid"
        ? order.updatedAt.toISOString()
        : null,
    email: order.email ?? undefined,
    paymentMethod: order.solanaPayDepositAddress ? "solana_pay" : undefined,
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
      subtotalUsd: subtotalCents / 100,
      shippingUsd,
      totalUsd,
    },
    statusUrl: `${process.env.NEXT_PUBLIC_AGENT_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://forthecult.store"}`.replace(
      /\/$/,
      "",
    ) + `/api/orders/${order.id}/status`,
  },
    { headers: getRateLimitHeaders(rl, RATE_LIMITS.api.limit) },
  );
}
