import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { createOrderTrackToken } from "~/lib/order-track-token";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

/**
 * POST /api/orders/track
 * Body: { orderId: string, lookupValue: string }
 *   OR legacy: { orderId: string, email?: string, paymentAddress?: string }
 *
 * lookupValue can be: billing email, payment (wallet) address, or shipping postal code.
 * If order exists and lookupValue matches any of these, returns { token, orderId }.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`order-track:${ip}`, RATE_LIMITS.api);
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const body = (await request.json().catch(() => ({}))) as {
      // Legacy fields for backward compatibility
      email?: string;
      lookupValue?: string;
      orderId?: string;
      paymentAddress?: string;
    };
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";

    // Support both new lookupValue and legacy email/paymentAddress
    let lookupValue =
      typeof body.lookupValue === "string" ? body.lookupValue.trim() : "";
    if (!lookupValue) {
      // Fallback to legacy fields
      if (typeof body.email === "string" && body.email.trim()) {
        lookupValue = body.email.trim();
      } else if (
        typeof body.paymentAddress === "string" &&
        body.paymentAddress.trim()
      ) {
        lookupValue = body.paymentAddress.trim();
      }
    }

    if (!orderId) {
      return NextResponse.json(
        {
          error: { code: "MISSING_ORDER_ID", message: "Order ID is required" },
        },
        { status: 400 },
      );
    }
    if (!lookupValue) {
      return NextResponse.json(
        {
          error: {
            code: "MISSING_PROOF",
            message:
              "Please provide your billing email, payment address, or postal code",
          },
        },
        { status: 400 },
      );
    }

    const [order] = await db
      .select({
        email: ordersTable.email,
        id: ordersTable.id,
        payerWalletAddress: ordersTable.payerWalletAddress,
        shippingZip: ordersTable.shippingZip,
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

    const normalizedLookup = normalize(lookupValue);
    const emailMatch = normalize(order.email) === normalizedLookup;
    const addressMatch =
      normalize(order.payerWalletAddress) === normalizedLookup;
    const postalMatch = normalize(order.shippingZip) === normalizedLookup;

    if (!emailMatch && !addressMatch && !postalMatch) {
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
    return NextResponse.json({ orderId: order.id, token });
  } catch (err) {
    console.error("Order track error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}

function normalize(value: null | string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}
