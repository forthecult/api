import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { orderItemsTable, ordersTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";
import { auth } from "~/lib/auth";

const PAYMENT_WINDOW_MS = 60 * 60 * 1000;

/** Normalize email for ownership check (lowercase, trim). */
function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Full order details: items, shipping, totals, payment summary.
 * GET /api/orders/{orderId}
 * Requires: authenticated owner (session user whose userId or email matches order) or admin.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    if (!orderId?.trim()) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const [order] = await db
      .select({
        id: ordersTable.id,
        status: ordersTable.status,
        createdAt: ordersTable.createdAt,
        updatedAt: ordersTable.updatedAt,
        email: ordersTable.email,
        userId: ordersTable.userId,
        totalCents: ordersTable.totalCents,
        shippingFeeCents: ordersTable.shippingFeeCents,
        paymentMethod: ordersTable.paymentMethod,
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

    if (!order) {
      return NextResponse.json(
        { error: { code: "ORDER_NOT_FOUND", message: "Order not found" } },
        { status: 404 },
      );
    }

    const adminAuth = await getAdminAuth(request);
    if (adminAuth?.ok) {
      // Admin: allow full access
    } else {
      const session = await auth.api.getSession({ headers: request.headers });
      const emailVerified = (session?.user as { emailVerified?: boolean })
        ?.emailVerified;
      const isOwner =
        session?.user &&
        (order.userId === session.user.id ||
          (emailVerified &&
            normalizeEmail(order.email) ===
              normalizeEmail(session.user.email)));
      if (!isOwner) {
        return NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Not authorized to view this order" } },
          { status: 401 },
        );
      }
    }

    const statusMap: Record<string, string> = {
      pending: "awaiting_payment",
      paid: "paid",
      fulfilled: "shipped",
      cancelled: "cancelled",
    };
    let status = statusMap[order.status] ?? order.status;
    if (order.status === "pending") {
      const expiresAt = order.createdAt.getTime() + PAYMENT_WINDOW_MS;
      if (Date.now() > expiresAt) status = "expired";
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

    const subtotalCents = items.reduce(
      (sum, i) => sum + i.priceCents * i.quantity,
      0,
    );
    const shippingUsd = (order.shippingFeeCents ?? 0) / 100;
    const subtotalUsd = subtotalCents / 100;
    const totalUsd = order.totalCents / 100;

    const paidAt =
      order.status === "paid" ? order.updatedAt.toISOString() : null;

    return NextResponse.json({
      orderId: order.id,
      status,
      createdAt: order.createdAt.toISOString(),
      paidAt,
      email: order.email ?? undefined,
      paymentMethod: order.paymentMethod ?? undefined,
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
        subtotalUsd,
        shippingUsd,
        totalUsd,
      },
      payment: order.solanaPayDepositAddress
        ? {
            chain: "solana",
            token: "USDC",
            amountUsd: totalUsd,
            transactionSignature: undefined,
          }
        : undefined,
      _actions: {
        ...(status === "awaiting_payment" && {
          next: `Poll GET /api/orders/${order.id}/status every 5s until status changes`,
          cancel: `POST /api/orders/${order.id}/cancel (only before payment)`,
        }),
        help: "Contact support@forthecult.store",
      },
    });
  } catch (err) {
    console.error("Order details error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load order" } },
      { status: 500 },
    );
  }
}
