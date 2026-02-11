import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";
import { auth } from "~/lib/auth";
import { cancelPrintfulOrder } from "~/lib/printful-orders";
import { cancelPrintifyOrder } from "~/lib/printify-orders";
import {
  getClientIp,
  checkRateLimit,
  rateLimitResponse,
} from "~/lib/rate-limit";

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}
function normalizePaymentAddress(addr: string | null | undefined): string {
  return (addr ?? "").trim().toLowerCase();
}
function normalizePostal(postal: string | null | undefined): string {
  return (postal ?? "").trim().replace(/\s+/g, "").toLowerCase();
}

/**
 * POST /api/orders/{orderId}/cancel
 *
 * Cancels an order if it hasn't been shipped yet.
 * Requires: authenticated owner (session), admin, or proof of ownership (body.lookupValue:
 * billing email, payment address, or shipping postal code).
 * Rate-limited to prevent brute-force of postal codes / lookup values.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    // Rate limit: 5 attempts per minute per IP to prevent brute-force
    const ip = getClientIp(request.headers);
    const rl = await checkRateLimit(`order-cancel:${ip}`, {
      limit: 5,
      windowSeconds: 60,
    });
    if (!rl.success) return rateLimitResponse(rl);

    const { orderId } = await params;
    if (!orderId?.trim()) {
      return NextResponse.json(
        { error: { code: "MISSING_ORDER_ID", message: "orderId required" } },
        { status: 400 },
      );
    }

    // Get the order (include fields needed for ownership verification)
    const [order] = await db
      .select({
        id: ordersTable.id,
        status: ordersTable.status,
        fulfillmentStatus: ordersTable.fulfillmentStatus,
        printfulOrderId: ordersTable.printfulOrderId,
        printifyOrderId: ordersTable.printifyOrderId,
        paymentStatus: ordersTable.paymentStatus,
        email: ordersTable.email,
        userId: ordersTable.userId,
        payerWalletAddress: ordersTable.payerWalletAddress,
        shippingZip: ordersTable.shippingZip,
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

    // Authorization: admin, session owner, or proof via lookupValue
    const adminAuth = await getAdminAuth(request);
    if (adminAuth?.ok) {
      // Admin: allow
    } else {
      const session = await auth.api.getSession({ headers: request.headers });
      const emailVerified = (session?.user as { emailVerified?: boolean })?.emailVerified;
      const isOwner =
        session?.user &&
        (order.userId === session.user.id ||
          (emailVerified &&
            normalizeEmail(order.email) === normalizeEmail(session.user.email)));
      if (isOwner) {
        // Session owner: allow
      } else {
        // Unauthenticated: require lookupValue (billing email, payment address, or postal code)
        let body: { lookupValue?: string };
        try {
          body = (await request.json().catch(() => ({}))) as { lookupValue?: string };
        } catch {
          body = {};
        }
        const lookupValue =
          typeof body.lookupValue === "string" ? body.lookupValue.trim() : "";
        if (!lookupValue) {
          return NextResponse.json(
            {
              error: {
                code: "UNAUTHORIZED",
                message:
                  "Sign in, use admin access, or provide billing email, payment address, or postal code in body as lookupValue",
              },
            },
            { status: 401 },
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
                code: "ORDER_NOT_FOUND",
                message: "Order not found or the details you entered don't match",
              },
            },
            { status: 404 },
          );
        }
      }
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
                code: "ORDER_IN_PROCESS",
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
                code: "ORDER_IN_PRODUCTION",
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

    const fulfillmentError = [
      printfulCancelResult.error,
      printifyCancelResult.error,
    ]
      .filter(Boolean)
      .join("; ");
    return NextResponse.json({
      orderId: order.id,
      status: "cancelled",
      message: "Order cancelled successfully",
      ...(fulfillmentError && { fulfillmentError }),
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
