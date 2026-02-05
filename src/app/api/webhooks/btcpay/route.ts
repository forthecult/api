import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import {
  createAndConfirmPrintfulOrder,
  hasPrintfulItems,
} from "~/lib/printful-orders";
import {
  createAndConfirmPrintifyOrder,
  hasPrintifyItems,
} from "~/lib/printify-orders";

/** BTCPay/Bitpay webhook: invoice status change. Confirm order when invoice is paid/settled. */
const SETTLED_STATUSES = new Set(["paid", "confirmed", "complete", "settled"]);

const BTCPAY_WEBHOOK_SECRET = process.env.BTCPAY_WEBHOOK_SECRET?.trim() ?? "";

/**
 * Verify webhook signature when BTCPAY_WEBHOOK_SECRET is set.
 * Bitpay/BTCPay legacy: X-Bitpay-Signature = "sha256=hexdigest" (HMAC-SHA256 of raw body).
 */
function verifyBtcpayWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!secret || !signatureHeader?.trim()) return false;
  const match = /^sha256=([a-f0-9]+)$/i.exec(signatureHeader.trim());
  if (!match) return false;
  const expectedHex = match[1];
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody, "utf8");
  const computedHex = hmac.digest("hex");
  if (expectedHex.length !== computedHex.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(expectedHex, "hex"),
    Buffer.from(computedHex, "hex"),
  );
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    let body: Record<string, unknown>;
    try {
      body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    if (BTCPAY_WEBHOOK_SECRET) {
      const signature =
        request.headers.get("x-bitpay-signature") ??
        request.headers.get("btcpay-signature");
      if (
        !verifyBtcpayWebhookSignature(
          rawBody,
          signature,
          BTCPAY_WEBHOOK_SECRET,
        )
      ) {
        return NextResponse.json(
          { error: "Invalid webhook signature" },
          { status: 401 },
        );
      }
    }

    // Bitpay-style: { id, status } or { data: { id, status } }
    // BTCPay Greenfield-style: { deliveryId, webhookId, type, storeId, invoiceId } and possibly payload
    const invoiceId =
      typeof body.invoiceId === "string"
        ? body.invoiceId
        : typeof (body.data as { id?: string })?.id === "string"
          ? (body.data as { id: string }).id
          : typeof body.id === "string"
            ? body.id
            : null;

    const statusRaw =
      typeof body.status === "string"
        ? body.status
        : ((body.data as { status?: string })?.status ??
          (body as { status?: string }).status);
    const status = typeof statusRaw === "string" ? statusRaw.toLowerCase() : "";

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Missing invoice id" },
        { status: 400 },
      );
    }

    const settled = SETTLED_STATUSES.has(status);

    if (!settled) {
      return NextResponse.json({ received: true, action: "none", status });
    }

    const [order] = await db
      .select({ id: ordersTable.id, status: ordersTable.status })
      .from(ordersTable)
      .where(eq(ordersTable.btcpayInvoiceId, invoiceId))
      .limit(1);

    if (!order) {
      return NextResponse.json({
        received: true,
        action: "order_not_found",
        invoiceId,
      });
    }
    if (order.status !== "pending") {
      return NextResponse.json({
        received: true,
        alreadyPaid: true,
        orderId: order.id,
      });
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

    const { onOrderCreated } = await import("~/lib/create-user-notification");
    void onOrderCreated(order.id);

    let printfulOrderId: number | undefined;
    let printifyOrderId: string | undefined;
    try {
      const hasPrintful = await hasPrintfulItems(order.id);
      if (hasPrintful) {
        const r = await createAndConfirmPrintfulOrder(order.id);
        if (r.success) printfulOrderId = r.printfulOrderId;
      }
    } catch {
      // log but don't fail webhook
    }
    try {
      const hasPrintify = await hasPrintifyItems(order.id);
      if (hasPrintify) {
        const r = await createAndConfirmPrintifyOrder(order.id);
        if (r.success) printifyOrderId = r.printifyOrderId;
      }
    } catch {
      // log but don't fail webhook
    }

    return NextResponse.json({
      received: true,
      action: "confirmed",
      orderId: order.id,
      ...(printfulOrderId && { printfulOrderId }),
      ...(printifyOrderId && { printifyOrderId }),
    });
  } catch (err) {
    console.error("BTCPay webhook error:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
