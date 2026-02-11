import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { getClientIp, RATE_LIMITS, checkRateLimit, rateLimitResponse } from "~/lib/rate-limit";

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

function normalizePaymentAddress(addr: string | null | undefined): string {
  return (addr ?? "").trim().toLowerCase();
}

function normalizePostal(postal: string | null | undefined): string {
  return (postal ?? "").trim().replace(/\s+/g, "").toLowerCase();
}

const CRYPTO_METHODS = ["solana_pay", "eth_pay", "btcpay", "ton_pay"];

/**
 * POST /api/refund/lookup
 * Body: { orderId: string, lookupValue: string }
 * lookupValue can be: billing email, payment (wallet) address, or shipping postal code.
 * Verifies the order exists and the requester is authorized.
 * Returns { isCrypto: boolean } so the client can show the refund-address field for crypto orders.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`refund-lookup:${ip}`, RATE_LIMITS.api);
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const body = (await request.json().catch(() => ({}))) as {
      orderId?: string;
      lookupValue?: string;
    };
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const lookupValue =
      typeof body.lookupValue === "string" ? body.lookupValue.trim() : "";

    if (!orderId) {
      return NextResponse.json(
        { error: { code: "MISSING_ORDER_ID", message: "Order ID is required" } },
        { status: 400 },
      );
    }
    if (!lookupValue) {
      return NextResponse.json(
        {
          error: {
            code: "MISSING_LOOKUP",
            message:
              "Please enter your billing email, payment address, or postal code",
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
        shippingZip: ordersTable.shippingZip,
        paymentMethod: ordersTable.paymentMethod,
        paymentStatus: ordersTable.paymentStatus,
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
      normalizeEmail(order.email) === normalizeEmail(lookupValue);
    const addressMatch =
      normalizePaymentAddress(order.payerWalletAddress) ===
      normalizePaymentAddress(lookupValue);
    const postalMatch =
      normalizePostal(order.shippingZip) === normalizePostal(lookupValue);

    if (!emailMatch && !addressMatch && !postalMatch) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message:
              "Order not found or the details you entered don't match",
          },
        },
        { status: 404 },
      );
    }

    const isCrypto =
      order.paymentMethod != null &&
      CRYPTO_METHODS.includes(order.paymentMethod);

    return NextResponse.json({ isCrypto });
  } catch (err) {
    console.error("Refund lookup error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
