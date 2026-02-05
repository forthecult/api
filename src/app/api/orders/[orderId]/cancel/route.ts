import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { cancelPrintfulOrder } from "~/lib/printful-orders";
import { cancelPrintifyOrder } from "~/lib/printify-orders";

/**
 * POST /api/orders/{orderId}/cancel
 *
 * Cancels an order if it hasn't been shipped yet.
 * Also cancels the corresponding Printful order if one exists.
 *
 * Note: This endpoint doesn't handle refunds - that should be done separately
 * through the payment provider (Stripe, etc.)
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    if (!orderId?.trim()) {
      return NextResponse.json(
        { error: { code: "MISSING_ORDER_ID", message: "orderId required" } },
        { status: 400 },
      );
    }

    // Get the order
    const [order] = await db
      .select({
        id: ordersTable.id,
        status: ordersTable.status,
        fulfillmentStatus: ordersTable.fulfillmentStatus,
        printfulOrderId: ordersTable.printfulOrderId,
        printifyOrderId: ordersTable.printifyOrderId,
        paymentStatus: ordersTable.paymentStatus,
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

    // Check if order can be cancelled
    if (order.status === "cancelled") {
      return NextResponse.json({
        orderId: order.id,
        status: "cancelled",
        message: "Order is already cancelled",
      });
    }

    if (
      order.status === "fulfilled" ||
      order.fulfillmentStatus === "fulfilled"
    ) {
      return NextResponse.json(
        {
          error: {
            code: "ORDER_ALREADY_FULFILLED",
            message: "Cannot cancel a fulfilled order",
          },
        },
        { status: 400 },
      );
    }

    // If order has shipped (partially or fully), can't cancel
    if (order.fulfillmentStatus === "partially_fulfilled") {
      return NextResponse.json(
        {
          error: {
            code: "ORDER_PARTIALLY_SHIPPED",
            message: "Cannot cancel an order that has partially shipped",
          },
        },
        { status: 400 },
      );
    }

    // Try to cancel Printful order if one exists
    let printfulCancelResult: { success: boolean; error?: string } = {
      success: true,
    };
    if (order.printfulOrderId) {
      console.log(
        `Cancelling Printful order ${order.printfulOrderId} for order ${orderId}`,
      );
      printfulCancelResult = await cancelPrintfulOrder(orderId);

      if (!printfulCancelResult.success) {
        // Printful order couldn't be cancelled (might already be in production)
        console.warn(
          `Printful cancellation failed: ${printfulCancelResult.error}`,
        );

        // If the Printful order is already in process, we can't cancel our order either
        if (printfulCancelResult.error?.includes("in process")) {
          return NextResponse.json(
            {
              error: {
                code: "PRINTFUL_ORDER_IN_PROCESS",
                message:
                  "Order is already being processed by fulfillment and cannot be cancelled",
              },
            },
            { status: 400 },
          );
        }
        // For other Printful errors, log but continue with local cancellation
      }
    }

    // Try to cancel Printify order if one exists
    let printifyCancelResult: { success: boolean; error?: string } = {
      success: true,
    };
    if (order.printifyOrderId) {
      console.log(
        `Cancelling Printify order ${order.printifyOrderId} for order ${orderId}`,
      );
      printifyCancelResult = await cancelPrintifyOrder(orderId);

      if (!printifyCancelResult.success) {
        // Printify order couldn't be cancelled (might already be in production)
        console.warn(
          `Printify cancellation failed: ${printifyCancelResult.error}`,
        );

        // If the Printify order is already in production, we can't cancel our order either
        if (printifyCancelResult.error?.includes("in production")) {
          return NextResponse.json(
            {
              error: {
                code: "PRINTIFY_ORDER_IN_PRODUCTION",
                message:
                  "Order is already being processed by fulfillment and cannot be cancelled",
              },
            },
            { status: 400 },
          );
        }
        // For other Printify errors, log but continue with local cancellation
      }
    }

    // Update order status
    await db
      .update(ordersTable)
      .set({
        status: "cancelled",
        fulfillmentStatus: "unfulfilled",
        updatedAt: new Date(),
        // Clear printfulOrderId if we successfully cancelled
        ...(printfulCancelResult.success && order.printfulOrderId
          ? { printfulOrderId: null }
          : {}),
        // Clear printifyOrderId if we successfully cancelled
        ...(printifyCancelResult.success && order.printifyOrderId
          ? { printifyOrderId: null }
          : {}),
      })
      .where(eq(ordersTable.id, orderId));

    return NextResponse.json({
      orderId: order.id,
      status: "cancelled",
      message: "Order cancelled successfully",
      printfulCancelled: order.printfulOrderId
        ? printfulCancelResult.success
        : undefined,
      printfulError: printfulCancelResult.error,
      printifyCancelled: order.printifyOrderId
        ? printifyCancelResult.success
        : undefined,
      printifyError: printifyCancelResult.error,
      _actions: {
        refund:
          order.paymentStatus === "paid"
            ? "Refund should be processed separately through your payment provider"
            : undefined,
      },
    });
  } catch (err) {
    console.error("Order cancellation error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to cancel order" } },
      { status: 500 },
    );
  }
}
