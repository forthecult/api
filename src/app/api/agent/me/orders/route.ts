import { desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
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
 * GET /api/agent/me/orders
 *
 * Returns orders placed by the authenticated Moltbook agent (X-Moltbook-Identity).
 * Requires valid identity token. Orders are those created with the same token at checkout.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`agent:me/orders:${ip}`, RATE_LIMITS.api);
  if (!rl.success) return rateLimitResponse(rl, RATE_LIMITS.api.limit);

  const result = await getMoltbookAgentFromRequest(request);
  if ("error" in result) return result.error;

  const { agent } = result;

  const orders = await db
    .select({
      createdAt: ordersTable.createdAt,
      email: ordersTable.email,
      id: ordersTable.id,
      paymentStatus: ordersTable.paymentStatus,
      status: ordersTable.status,
      totalCents: ordersTable.totalCents,
    })
    .from(ordersTable)
    .where(eq(ordersTable.moltbookAgentId, agent.id))
    .orderBy(desc(ordersTable.createdAt))
    .limit(50);

  const baseUrl =
    process.env.NEXT_PUBLIC_AGENT_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://forthecult.store";

  return NextResponse.json(
    {
      agent: { id: agent.id, name: agent.name },
      orders: orders.map((o) => ({
        createdAt: o.createdAt.toISOString(),
        detailUrl: `${baseUrl.replace(/\/$/, "")}/api/agent/me/orders/${o.id}`,
        orderId: o.id,
        status: STATUS_MAP[o.status] ?? o.status,
        statusUrl: `${baseUrl.replace(/\/$/, "")}/api/orders/${o.id}/status`,
        totalUsd: o.totalCents / 100,
      })),
      total: orders.length,
    },
    { headers: getRateLimitHeaders(rl, RATE_LIMITS.api.limit) },
  );
}
