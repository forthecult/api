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

/**
 * Mark TON order as paid (called by frontend after payment detected, or by future TON webhook/cron).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { orderId?: string };
    const orderId = body?.orderId?.trim();

    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const [order] = await db
      .select({
        id: ordersTable.id,
        status: ordersTable.status,
        paymentMethod: ordersTable.paymentMethod,
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

    return NextResponse.json({
      orderId: order.id,
      ...(printfulOrderId && { printfulOrderId }),
      ...(printfulError && { printfulError }),
      ...(printifyOrderId && { printifyOrderId }),
      ...(printifyError && { printifyError }),
    });
  } catch (err) {
    console.error("TON Pay confirm error:", err);
    return NextResponse.json(
      { error: "Failed to confirm order" },
      { status: 500 },
    );
  }
}
