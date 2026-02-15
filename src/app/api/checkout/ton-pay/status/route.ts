import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

/**
 * GET ?orderId=
 * Returns payment status for TON order (for polling from crypto payment page).
 * When order is already paid, returns settled: true.
 * Otherwise returns pending (payment detection can be added via TON API or webhook later).
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`ton-status:${ip}`, RATE_LIMITS.orderStatus);
  if (!rl.success) return rateLimitResponse(rl);
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId")?.trim();

    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const [order] = await db
      .select({
        id: ordersTable.id,
        paymentMethod: ordersTable.paymentMethod,
        paymentStatus: ordersTable.paymentStatus,
        status: ordersTable.status,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.paymentMethod !== "ton_pay") {
      return NextResponse.json(
        { error: "Order is not a TON payment" },
        { status: 400 },
      );
    }

    const settled = order.status === "paid" || order.paymentStatus === "paid";

    return NextResponse.json({
      orderStatus: order.status,
      settled,
      status: settled ? "paid" : "pending",
    });
  } catch (err) {
    console.error("TON Pay status error:", err);
    return NextResponse.json(
      { error: "Failed to get payment status" },
      { status: 500 },
    );
  }
}
