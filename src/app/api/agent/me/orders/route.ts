import { desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { getMoltbookAgentFromRequest } from "~/lib/moltbook-auth";

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
 * GET /api/agent/me/orders
 *
 * Returns orders placed by the authenticated Moltbook agent (X-Moltbook-Identity).
 * Requires valid identity token. Orders are those created with the same token at checkout.
 */
export async function GET(request: NextRequest) {
  const result = await getMoltbookAgentFromRequest(request);
  if ("error" in result) return result.error;

  const { agent } = result;

  const orders = await db
    .select({
      id: ordersTable.id,
      status: ordersTable.status,
      paymentStatus: ordersTable.paymentStatus,
      totalCents: ordersTable.totalCents,
      createdAt: ordersTable.createdAt,
      email: ordersTable.email,
    })
    .from(ordersTable)
    .where(eq(ordersTable.moltbookAgentId, agent.id))
    .orderBy(desc(ordersTable.createdAt))
    .limit(50);

  const baseUrl =
    process.env.NEXT_PUBLIC_AGENT_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://forthecult.store";

  return NextResponse.json({
    agent: { id: agent.id, name: agent.name },
    orders: orders.map((o) => ({
      orderId: o.id,
      status: STATUS_MAP[o.status] ?? o.status,
      totalUsd: o.totalCents / 100,
      createdAt: o.createdAt.toISOString(),
      statusUrl: `${baseUrl.replace(/\/$/, "")}/api/orders/${o.id}/status`,
      detailUrl: `${baseUrl.replace(/\/$/, "")}/api/agent/me/orders/${o.id}`,
    })),
    total: orders.length,
  });
}
