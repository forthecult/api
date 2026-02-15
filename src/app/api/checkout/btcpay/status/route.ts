import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import {
  getBtcpayConfig,
  getBtcpayInvoiceStatus,
  type InvoiceStatus,
  isInvoiceSettled,
} from "~/lib/btcpay";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

/**
 * GET ?orderId= or ?invoiceId=
 * Returns invoice status for BTCPay (for polling from crypto payment page).
 * When BTCPay is not configured, returns { status: "not_configured" } for known order.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(
    `btcpay-status:${ip}`,
    RATE_LIMITS.orderStatus,
  );
  if (!rl.success) return rateLimitResponse(rl);
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId")?.trim();
    const invoiceId = searchParams.get("invoiceId")?.trim();

    if (!orderId && !invoiceId) {
      return NextResponse.json(
        { error: "orderId or invoiceId required" },
        { status: 400 },
      );
    }

    const { configured } = getBtcpayConfig();

    if (invoiceId && configured) {
      const status = await getBtcpayInvoiceStatus(invoiceId);
      return NextResponse.json({
        settled: isInvoiceSettled(status),
        status: status ?? "invalid",
      });
    }

    if (orderId) {
      const [order] = await db
        .select({
          btcpayInvoiceId: ordersTable.btcpayInvoiceId,
          id: ordersTable.id,
          status: ordersTable.status,
        })
        .from(ordersTable)
        .where(eq(ordersTable.id, orderId))
        .limit(1);

      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      if (order.status !== "pending") {
        return NextResponse.json({
          orderStatus: order.status,
          settled: true,
          status: "paid" as InvoiceStatus,
        });
      }

      if (!configured) {
        return NextResponse.json({
          settled: false,
          status: "not_configured",
        });
      }

      const invId = order.btcpayInvoiceId?.trim();
      if (!invId) {
        return NextResponse.json({
          settled: false,
          status: "no_invoice",
        });
      }

      const status = await getBtcpayInvoiceStatus(invId);
      return NextResponse.json({
        invoiceId: invId,
        settled: isInvoiceSettled(status),
        status: status ?? "invalid",
      });
    }

    return NextResponse.json(
      { error: "orderId or invoiceId required" },
      { status: 400 },
    );
  } catch (err) {
    console.error("BTCPay status error:", err);
    return NextResponse.json(
      { error: "Failed to get invoice status" },
      { status: 500 },
    );
  }
}
