import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { createOrderTrackToken } from "~/lib/order-track-token";
import { getClientIp, RATE_LIMITS, checkRateLimit, rateLimitResponse } from "~/lib/rate-limit";

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

function normalizePaymentAddress(addr: string | null | undefined): string {
  return (addr ?? "").trim().toLowerCase();
}

/**
 * POST /api/orders/track
 * Body: { orderId: string, email?: string, paymentAddress?: string }
 * At least one of email or paymentAddress required.
 * If order exists and (order.email matches email or order.payerWalletAddress matches paymentAddress),
 * returns { token, orderId } for use in /track-order/[orderId]?t=token.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`order-track:${ip}`, RATE_LIMITS.api);
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const body = (await request.json().catch(() => ({}))) as {
      orderId?: string;
      email?: string;
      paymentAddress?: string;
    };
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const email = typeof body.email === "string" ? body.email : undefined;
    const paymentAddress =
      typeof body.paymentAddress === "string" ? body.paymentAddress : undefined;

    if (!orderId) {
      return NextResponse.json(
        { error: { code: "MISSING_ORDER_ID", message: "Order ID is required" } },
        { status: 400 },
      );
    }
    if (!email?.trim() && !paymentAddress?.trim()) {
      return NextResponse.json(
        {
          error: {
            code: "MISSING_PROOF",
            message: "Please provide either billing email or payment address",
          },
        },
        { status: 400 },
      );
    }

    const [order] = await db
      .select({
        id: ordersTable.id,
        email: ordersTable.email,
        payerWalletAddress: ordersTable.payerWalletAddress,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) {
      return NextResponse.json(
        { error: { code: "ORDER_NOT_FOUND", message: "Order not found" } },
        { status: 404 },
      );
    }

    const emailMatch =
      email != null &&
      email.trim() !== "" &&
      normalizeEmail(order.email) === normalizeEmail(email);
    const addressMatch =
      paymentAddress != null &&
      paymentAddress.trim() !== "" &&
      normalizePaymentAddress(order.payerWalletAddress) ===
        normalizePaymentAddress(paymentAddress);

    if (!emailMatch && !addressMatch) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Order not found or the details you entered don't match",
          },
        },
        { status: 404 },
      );
    }

    const token = createOrderTrackToken(order.id);
    return NextResponse.json({ token, orderId: order.id });
  } catch (err) {
    console.error("Order track error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
