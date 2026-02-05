import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { apiError, apiSuccess } from "~/lib/api-error";

const PAYMENT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Lightweight order status for polling. No auth; orderId is the secret.
 * GET /api/orders/{orderId}/status
 *
 * Poll every 5 seconds until status changes from "awaiting_payment" to "paid".
 * Status values: awaiting_payment | paid | processing | shipped | delivered | cancelled | expired
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    if (!orderId?.trim()) {
      return apiError("MISSING_REQUIRED_FIELD", { field: "orderId" });
    }

    const [order] = await db
      .select({
        id: ordersTable.id,
        status: ordersTable.status,
        paymentStatus: ordersTable.paymentStatus,
        createdAt: ordersTable.createdAt,
        updatedAt: ordersTable.updatedAt,
        cryptoTxHash: ordersTable.cryptoTxHash,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId.trim()))
      .limit(1);

    if (!order) {
      return apiError("ORDER_NOT_FOUND", { orderId: orderId.trim() });
    }

    // Map internal status to API status
    const statusMap: Record<string, string> = {
      pending: "awaiting_payment",
      paid: "paid",
      processing: "processing",
      fulfilled: "shipped",
      shipped: "shipped",
      delivered: "delivered",
      cancelled: "cancelled",
    };
    let status = statusMap[order.status] ?? order.status;

    // Check if payment is confirmed but order not yet updated
    if (order.paymentStatus === "paid" && order.status === "pending") {
      status = "paid";
    }

    // Check expiration for pending orders
    let expiresAt: string | undefined;
    if (order.status === "pending" && order.paymentStatus !== "paid") {
      const expiresMs = order.createdAt.getTime() + PAYMENT_WINDOW_MS;
      expiresAt = new Date(expiresMs).toISOString();
      if (Date.now() > expiresMs) {
        status = "expired";
      }
    }

    const paidAt =
      status === "paid" || order.paymentStatus === "paid"
        ? order.updatedAt.toISOString()
        : undefined;

    // Build contextual actions based on current status
    const actions: Record<string, string> = {};

    if (status === "awaiting_payment") {
      actions.next = `Poll GET /api/orders/${order.id}/status every 5 seconds until status changes`;
      actions.cancel = `POST /api/orders/${order.id}/cancel (only before payment received)`;
    }

    if (status === "paid" || status === "processing" || status === "shipped") {
      actions.details = `GET /api/orders/${order.id} for full order details including shipping`;
    }

    if (status === "expired") {
      actions.retry = "POST /api/checkout to create a new order";
    }

    actions.help = "Email support@culturestore.com for assistance";

    return apiSuccess({
      orderId: order.id,
      status,
      paidAt: paidAt ?? null,
      ...(order.cryptoTxHash && { txHash: order.cryptoTxHash }),
      ...(expiresAt && status === "awaiting_payment" && { expiresAt }),
      _actions: actions,
    });
  } catch (err) {
    console.error("Order status error:", err);
    return apiError("INTERNAL_ERROR");
  }
}
