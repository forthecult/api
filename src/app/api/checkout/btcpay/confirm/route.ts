import { type NextRequest, NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import {
  getBtcpayInvoiceStatus,
  isInvoiceSettled,
} from "~/lib/btcpay";
import {
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitResponse,
} from "~/lib/rate-limit";
import {
  createAndConfirmPrintfulOrder,
  hasPrintfulItems,
} from "~/lib/printful-orders";
import { onOrderCreated } from "~/lib/create-user-notification";
import {
  createAndConfirmPrintifyOrder,
  hasPrintifyItems,
} from "~/lib/printify-orders";

/** Mark order as paid only after BTCPay invoice is verified settled (prevents spoofing). */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimitResult = checkRateLimit(
      `btcpay-confirm:${ip}`,
      RATE_LIMITS.checkout,
    );
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const body = (await request.json()) as {
      orderId?: string;
      invoiceId?: string;
    };
    const { orderId, invoiceId } = body;

    const byOrderId =
      orderId && typeof orderId === "string" && orderId.trim()
        ? eq(ordersTable.id, orderId.trim())
        : undefined;
    const byInvoiceId =
      invoiceId && typeof invoiceId === "string" && invoiceId.trim()
        ? eq(ordersTable.btcpayInvoiceId, invoiceId.trim())
        : undefined;

    const conditions = [byOrderId, byInvoiceId].filter(Boolean);
    if (conditions.length === 0) {
      return NextResponse.json(
        { error: "orderId or invoiceId required" },
        { status: 400 },
      );
    }

    const [order] = await db
      .select({
        id: ordersTable.id,
        status: ordersTable.status,
        btcpayInvoiceId: ordersTable.btcpayInvoiceId,
      })
      .from(ordersTable)
      .where(or(...conditions))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.status !== "pending") {
      return NextResponse.json({ orderId: order.id, alreadyPaid: true });
    }

    const invoiceIdToVerify =
      order.btcpayInvoiceId ?? (typeof invoiceId === "string" ? invoiceId.trim() : null);
    if (!invoiceIdToVerify) {
      return NextResponse.json(
        { error: "Order has no BTCPay invoice to verify" },
        { status: 400 },
      );
    }
    const invoiceStatus = await getBtcpayInvoiceStatus(invoiceIdToVerify);
    if (!isInvoiceSettled(invoiceStatus)) {
      return NextResponse.json(
        {
          error: "Invoice not settled",
          invoiceId: invoiceIdToVerify,
          status: invoiceStatus ?? "unknown",
        },
        { status: 400 },
      );
    }

    await db
      .update(ordersTable)
      .set({
        fulfillmentStatus: "unfulfilled",
        paymentStatus: "paid",
        status: "paid",
        updatedAt: new Date(),
      })
      .where(eq(ordersTable.id, order.id));

    void onOrderCreated(order.id);

    let printfulOrderId: number | undefined;
    let printfulError: string | undefined;
    try {
      const hasPrintful = await hasPrintfulItems(order.id);
      if (hasPrintful) {
        const printfulResult = await createAndConfirmPrintfulOrder(order.id);
        if (printfulResult.success)
          printfulOrderId = printfulResult.printfulOrderId;
        else printfulError = printfulResult.error;
      }
    } catch (pfError) {
      printfulError =
        pfError instanceof Error ? pfError.message : "Unknown error";
    }

    let printifyOrderId: string | undefined;
    let printifyError: string | undefined;
    try {
      const hasPrintify = await hasPrintifyItems(order.id);
      if (hasPrintify) {
        const printifyResult = await createAndConfirmPrintifyOrder(order.id);
        if (printifyResult.success)
          printifyOrderId = printifyResult.printifyOrderId;
        else printifyError = printifyResult.error;
      }
    } catch (pyError) {
      printifyError =
        pyError instanceof Error ? pyError.message : "Unknown error";
    }

    const fulfillmentError = [printfulError, printifyError]
      .filter(Boolean)
      .join("; ");
    return NextResponse.json({
      orderId: order.id,
      ...(fulfillmentError && { fulfillmentError }),
    });
  } catch (err) {
    console.error("BTCPay confirm error:", err);
    return NextResponse.json(
      { error: "Failed to confirm order" },
      { status: 500 },
    );
  }
}
