import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { createElement } from "react";

import { db } from "~/db";
import { ordersTable, refundRequestsTable } from "~/db/schema";
import { StaffRefundAlertEmail } from "~/emails/staff-refund-alert";
import { onRefundRequestSubmitted } from "~/lib/create-user-notification";
import { sendEmail } from "~/lib/email/send-email";
import { cancelPrintfulOrder } from "~/lib/printful-orders";
import { cancelPrintifyOrder } from "~/lib/printify-orders";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

const BODY_LIMIT = 4 * 1024; // 4 KB

function normalizeEmail(email: null | string | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

function normalizePaymentAddress(addr: null | string | undefined): string {
  return (addr ?? "").trim().toLowerCase();
}

function normalizePostal(postal: null | string | undefined): string {
  return (postal ?? "").trim().replace(/\s+/g, "").toLowerCase();
}

const CRYPTO_METHODS = ["solana_pay", "eth_pay", "btcpay", "ton_pay"];

/**
 * POST /api/refund/request
 * Body: { orderId: string, lookupValue: string, refundAddress?: string }
 * lookupValue can be: billing email, payment (wallet) address, or shipping postal code.
 * Verifies the order and requester; for crypto orders, refundAddress is required.
 * Sends a refund request to support email for staff to process.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rateLimitResult = await checkRateLimit(
    `refund-request:${ip}`,
    RATE_LIMITS.contact,
  );
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const raw = await request.text();
    if (raw.length > BODY_LIMIT) {
      return NextResponse.json(
        {
          error: {
            code: "BODY_TOO_LARGE",
            message: "Request body too large",
          },
        },
        { status: 400 },
      );
    }
    interface Body {
      lookupValue?: string;
      orderId?: string;
      refundAddress?: string;
    }
    let body: Body;
    try {
      body = JSON.parse(raw) as Body;
    } catch {
      body = {};
    }
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const lookupValue =
      typeof body.lookupValue === "string" ? body.lookupValue.trim() : "";
    const refundAddress =
      typeof body.refundAddress === "string" ? body.refundAddress.trim() : "";

    if (!orderId) {
      return NextResponse.json(
        {
          error: {
            code: "MISSING_ORDER_ID",
            message: "Order ID is required",
          },
        },
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
        email: ordersTable.email,
        fulfillmentStatus: ordersTable.fulfillmentStatus,
        id: ordersTable.id,
        payerWalletAddress: ordersTable.payerWalletAddress,
        paymentMethod: ordersTable.paymentMethod,
        paymentStatus: ordersTable.paymentStatus,
        printfulOrderId: ordersTable.printfulOrderId,
        printifyOrderId: ordersTable.printifyOrderId,
        shippingZip: ordersTable.shippingZip,
        status: ordersTable.status,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) {
      return NextResponse.json(
        {
          error: {
            code: "ORDER_NOT_FOUND",
            message: "Order not found",
          },
        },
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
            message: "Order not found or the details you entered don't match",
          },
        },
        { status: 404 },
      );
    }

    const isCrypto =
      order.paymentMethod != null &&
      CRYPTO_METHODS.includes(order.paymentMethod);

    if (isCrypto && !refundAddress) {
      return NextResponse.json(
        {
          error: {
            code: "REFUND_ADDRESS_REQUIRED",
            message:
              "This order was paid with crypto. Please provide the wallet address for your refund (stablecoin).",
          },
        },
        { status: 400 },
      );
    }

    // For crypto orders, refund address must match the original payer wallet
    // to prevent fund diversion by someone who knows orderId + postal code
    if (isCrypto && refundAddress && order.payerWalletAddress) {
      if (
        normalizePaymentAddress(refundAddress) !==
        normalizePaymentAddress(order.payerWalletAddress)
      ) {
        return NextResponse.json(
          {
            error: {
              code: "REFUND_ADDRESS_MISMATCH",
              message:
                "Refund address must match the wallet used for payment. " +
                "If you need a refund to a different address, please contact support.",
            },
          },
          { status: 400 },
        );
      }
    }

    const to =
      (typeof process.env.CONTACT_TO_EMAIL === "string" &&
        process.env.CONTACT_TO_EMAIL.trim()) ||
      "support@forthecult.store";

    const replyTo = order.email?.trim() || undefined;
    const safeOrderId = orderId.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeLookup = lookupValue.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeRefundAddr = refundAddress
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const htmlParts = [
      "<p><strong>Refund request</strong></p>",
      `<p><strong>Order ID:</strong> ${safeOrderId}</p>`,
      `<p><strong>Lookup value (email / payment address / postal):</strong> ${safeLookup}</p>`,
      `<p><strong>Order billing email:</strong> ${(order.email ?? "—").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
    ];
    if (isCrypto && refundAddress) {
      htmlParts.push(
        `<p><strong>Refund wallet address (stablecoin):</strong> ${safeRefundAddr}</p>`,
      );
    }
    htmlParts.push(
      "<p>Process this refund in admin and mark the order as refunded. The customer will be notified on their chosen transactional channels.</p>",
    );

    if (process.env.RESEND_API_KEY) {
      try {
        const htmlBody = htmlParts.join("");
        const res = await sendEmail({
          correlationId: `refund-staff-${orderId}`,
          internal: true,
          kind: "internal_staff_refund_alert",
          react: createElement(StaffRefundAlertEmail, { htmlBody }),
          replyTo,
          subject: `[Refund request] Order ${orderId.slice(0, 12)}…`,
          to,
        });
        if (res.ok === false && !("skipped" in res && res.skipped)) {
          console.error("[Refund request] sendEmail failed:", res);
          return NextResponse.json(
            {
              error: {
                code: "SEND_FAILED",
                message: "Failed to submit refund request. Please try again.",
              },
            },
            { status: 500 },
          );
        }
      } catch (err) {
        console.error("[Refund request] send failed:", err);
        return NextResponse.json(
          {
            error: {
              code: "SEND_FAILED",
              message: "Failed to submit refund request. Please try again.",
            },
          },
          { status: 500 },
        );
      }
    } else if (process.env.NODE_ENV === "development") {
      console.log("[Refund request] No RESEND_API_KEY - would send to", to, {
        lookupValue,
        orderId,
        refundAddress: isCrypto ? refundAddress : "—",
      });
    }

    const now = new Date();
    await db.insert(refundRequestsTable).values({
      createdAt: now,
      id: createId(),
      orderId,
      refundAddress: isCrypto && refundAddress ? refundAddress : null,
      status: "requested",
      updatedAt: now,
    });

    // If order has not been shipped, set status to refund_pending and cancel Printful/Printify
    const notShipped =
      order.status !== "fulfilled" &&
      order.fulfillmentStatus !== "fulfilled" &&
      order.fulfillmentStatus !== "partially_fulfilled";
    if (notShipped) {
      await db
        .update(ordersTable)
        .set({
          paymentStatus: "refund_pending",
          status: "refund_pending",
          updatedAt: now,
        })
        .where(eq(ordersTable.id, orderId));

      let printfulCleared = false;
      let printifyCleared = false;
      if (order.printfulOrderId) {
        const pf = await cancelPrintfulOrder(orderId);
        if (pf.success) printfulCleared = true;
        else
          console.warn(
            `[Refund request] Printful cancel failed for order ${orderId}: ${pf.error}`,
          );
      }
      if (order.printifyOrderId) {
        const py = await cancelPrintifyOrder(orderId);
        if (py.success) printifyCleared = true;
        else
          console.warn(
            `[Refund request] Printify cancel failed for order ${orderId}: ${py.error}`,
          );
      }
      if (printfulCleared || printifyCleared) {
        await db
          .update(ordersTable)
          .set({
            updatedAt: new Date(),
            ...(printfulCleared && order.printfulOrderId
              ? { printfulOrderId: null }
              : {}),
            ...(printifyCleared && order.printifyOrderId
              ? { printifyOrderId: null }
              : {}),
          })
          .where(eq(ordersTable.id, orderId));
      }
    }

    void onRefundRequestSubmitted(orderId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Refund request error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Something went wrong. Please try again.",
        },
      },
      { status: 500 },
    );
  }
}
