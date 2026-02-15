import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { getBtcpayInvoiceStatus, isInvoiceSettled } from "~/lib/btcpay";
import { onOrderCreated } from "~/lib/create-user-notification";
import { fulfillEsimOrder, hasEsimItems } from "~/lib/esim-fulfillment";
import {
  createAndConfirmPrintfulOrder,
  hasPrintfulItems,
} from "~/lib/printful-orders";
import {
  createAndConfirmPrintifyOrder,
  hasPrintifyItems,
} from "~/lib/printify-orders";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

/** Mark order as paid only after BTCPay invoice is verified settled (prevents spoofing). */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(
      `btcpay-confirm:${ip}`,
      RATE_LIMITS.checkout,
    );
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const body = (await request.json()) as {
      orderId?: string;
    };
    const orderId =
      body.orderId && typeof body.orderId === "string"
        ? body.orderId.trim()
        : undefined;

    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const [order] = await db
      .select({
        btcpayInvoiceId: ordersTable.btcpayInvoiceId,
        id: ordersTable.id,
        paymentMethod: ordersTable.paymentMethod,
        status: ordersTable.status,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.paymentMethod !== "btcpay") {
      return NextResponse.json(
        { error: "Not a BTCPay order" },
        { status: 400 },
      );
    }
    if (order.status !== "pending") {
      return NextResponse.json({ alreadyPaid: true, orderId: order.id });
    }

    // Only use the server-stored invoice ID — never trust client-provided invoiceId
    const invoiceIdToVerify = order.btcpayInvoiceId;
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

    // Idempotent update: only transition from 'pending' to prevent double-fulfillment
    const updated = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ id: ordersTable.id, status: ordersTable.status })
        .from(ordersTable)
        .where(
          and(eq(ordersTable.id, order.id), eq(ordersTable.status, "pending")),
        )
        .limit(1);
      if (!current) return null; // already processed by a concurrent request
      await tx
        .update(ordersTable)
        .set({
          fulfillmentStatus: "unfulfilled",
          paymentStatus: "paid",
          status: "paid",
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, order.id));
      return current;
    });

    if (!updated) {
      return NextResponse.json({ alreadyPaid: true, orderId: order.id });
    }

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

    let esimError: string | undefined;
    try {
      const hasEsim = await hasEsimItems(order.id);
      if (hasEsim) {
        const esimResult = await fulfillEsimOrder(order.id);
        if (!esimResult.success) esimError = esimResult.error;
      }
    } catch (eError) {
      esimError = eError instanceof Error ? eError.message : "Unknown error";
    }

    const fulfillmentError = [printfulError, printifyError, esimError]
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
