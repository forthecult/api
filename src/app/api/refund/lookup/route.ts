import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

function normalizePaymentAddress(addr: string | null | undefined): string {
  return (addr ?? "").trim().toLowerCase();
}

const CRYPTO_METHODS = ["solana_pay", "eth_pay", "btcpay", "ton_pay"];

/**
 * POST /api/refund/lookup
 * Body: { orderId: string, email?: string, paymentAddress?: string }
 * Verifies the order exists and the requester is authorized (email or payment address match).
 * Returns { isCrypto: boolean } so the client can show the refund-address field for crypto orders.
 */
export async function POST(request: NextRequest) {
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
