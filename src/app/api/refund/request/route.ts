import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import {
  getClientIp,
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "~/lib/rate-limit";

const BODY_LIMIT = 4 * 1024; // 4 KB

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

function normalizePaymentAddress(addr: string | null | undefined): string {
  return (addr ?? "").trim().toLowerCase();
}

const CRYPTO_METHODS = ["solana_pay", "eth_pay", "btcpay", "ton_pay"];

/**
 * POST /api/refund/request
 * Body: { orderId: string, email?: string, paymentAddress?: string, refundAddress?: string }
 * Verifies the order and requester; for crypto orders, refundAddress is required.
 * Sends a refund request to support email for staff to process.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rateLimitResult = checkRateLimit(
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
    const body = (await JSON.parse(raw).catch(() => ({}))) as {
      orderId?: string;
      email?: string;
      paymentAddress?: string;
      refundAddress?: string;
    };
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const email = typeof body.email === "string" ? body.email : undefined;
    const paymentAddress =
      typeof body.paymentAddress === "string" ? body.paymentAddress : undefined;
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

    const to =
      (typeof process.env.CONTACT_TO_EMAIL === "string" &&
        process.env.CONTACT_TO_EMAIL.trim()) ||
      "support@forthecult.store";

    const replyTo = email?.trim() || undefined;
    const safeOrderId = orderId.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeEmail = (email ?? "").trim().replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeRefundAddr = refundAddress.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const htmlParts = [
      "<p><strong>Refund request</strong></p>",
      `<p><strong>Order ID:</strong> ${safeOrderId}</p>`,
      `<p><strong>Billing email:</strong> ${safeEmail || "—"}</p>`,
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
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const from =
          typeof process.env.RESEND_FROM_EMAIL === "string" &&
          process.env.RESEND_FROM_EMAIL.length > 0
            ? process.env.RESEND_FROM_EMAIL.trim()
            : "onboarding@resend.dev";
        const { error } = await resend.emails.send({
          from,
          to,
          replyTo: replyTo ?? undefined,
          subject: `[Refund request] Order ${orderId.slice(0, 12)}…`,
          html: `<!DOCTYPE html><html><body>${htmlParts.join("")}</body></html>`,
          text: `Refund request\nOrder ID: ${orderId}\nBilling email: ${email ?? "—"}\n${isCrypto && refundAddress ? `Refund address (stablecoin): ${refundAddress}\n` : ""}\nProcess in admin and mark as refunded.`,
        });
        if (error) {
          console.error("[Refund request] Resend error:", error);
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
        orderId,
        email: email ?? "—",
        refundAddress: isCrypto ? refundAddress : "—",
      });
    }

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
