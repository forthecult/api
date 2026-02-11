import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { onOrderCreated } from "~/lib/create-user-notification";
import {
  createAndConfirmPrintfulOrder,
  hasPrintfulItems,
} from "~/lib/printful-orders";
import {
  createAndConfirmPrintifyOrder,
  hasPrintifyItems,
} from "~/lib/printify-orders";
import {
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitResponse,
} from "~/lib/rate-limit";

/**
 * Mark TON order as paid after verifying the transaction.
 *
 * TODO: Implement full TON on-chain verification via TON Center API
 * (https://toncenter.com/api/v2/getTransactions) to verify that
 * the txHash exists on-chain, the destination matches the order's
 * deposit address, and the amount matches order.cryptoAmount.
 * For now we require txHash and store it, and use an idempotent
 * update to prevent double-processing.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(
      `ton-pay-confirm:${ip}`,
      RATE_LIMITS.checkout,
    );
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const body = (await request.json()) as {
      orderId?: string;
      txHash?: string;
    };
    const orderId = body?.orderId?.trim();
    const txHash = typeof body?.txHash === "string" ? body.txHash.trim() : "";

    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }
    if (!txHash) {
      return NextResponse.json(
        { error: "txHash required for payment verification" },
        { status: 400 },
      );
    }

    const [order] = await db
      .select({
        id: ordersTable.id,
        status: ordersTable.status,
        paymentMethod: ordersTable.paymentMethod,
        totalCents: ordersTable.totalCents,
        cryptoAmount: ordersTable.cryptoAmount,
        solanaPayDepositAddress: ordersTable.solanaPayDepositAddress,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.paymentMethod !== "ton_pay") {
      return NextResponse.json(
        { error: "Order is not a TON payment" },
        { status: 400 },
      );
    }
    if (order.status !== "pending") {
      return NextResponse.json({ orderId: order.id, alreadyPaid: true });
    }

    // TODO: Verify txHash on-chain via TON Center API:
    // 1. GET https://toncenter.com/api/v2/getTransactions?address={depositAddress}&limit=20
    // 2. Find transaction matching txHash
    // 3. Verify amount matches order.cryptoAmount or order.totalCents conversion
    // For now, we store the txHash and rely on the idempotent update below.

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
          cryptoTxHash: txHash,
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, order.id));
      return current;
    });

    if (!updated) {
      return NextResponse.json({ orderId: order.id, alreadyPaid: true });
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

    const fulfillmentError = [printfulError, printifyError]
      .filter(Boolean)
      .join("; ");
    return NextResponse.json({
      orderId: order.id,
      ...(fulfillmentError && { fulfillmentError }),
    });
  } catch (err) {
    console.error("TON Pay confirm error:", err);
    return NextResponse.json(
      { error: "Failed to confirm order" },
      { status: 500 },
    );
  }
}
