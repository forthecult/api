import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { esimOrdersTable } from "~/db/schema";
import { getCurrentUser } from "~/lib/auth";
import { trySyncProcessingEsimOrder } from "~/lib/esim-fulfillment";

/**
 * POST /api/esim/orders/[orderId]/retry-provisioning
 * Try to sync "processing" eSIM orders (esimId=null) with the provider.
 * Only the order owner can call this.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { message: "Authentication required", status: false },
        { status: 401 },
      );
    }

    const { orderId } = await params;
    if (!orderId?.trim()) {
      return NextResponse.json(
        { message: "Order ID is required", status: false },
        { status: 400 },
      );
    }

    const esimOrders = await db
      .select({ id: esimOrdersTable.id, userId: esimOrdersTable.userId })
      .from(esimOrdersTable)
      .where(eq(esimOrdersTable.orderId, orderId.trim()));

    if (esimOrders.length === 0) {
      return NextResponse.json(
        { message: "No eSIM orders found for this order", status: false },
        { status: 404 },
      );
    }

    const unauthorized = esimOrders.some((o) => o.userId !== user.id);
    if (unauthorized) {
      return NextResponse.json(
        { message: "You do not have access to this order", status: false },
        { status: 403 },
      );
    }

    const processing = await db
      .select({ id: esimOrdersTable.id })
      .from(esimOrdersTable)
      .where(
        and(
          eq(esimOrdersTable.orderId, orderId.trim()),
          eq(esimOrdersTable.status, "processing"),
          isNull(esimOrdersTable.esimId),
        ),
      );

    let updated = 0;
    for (const row of processing) {
      const result = await trySyncProcessingEsimOrder(row.id);
      if (result.linked) updated++;
    }

    return NextResponse.json({
      status: true,
      updated,
    });
  } catch (error) {
    console.error("eSIM retry-provisioning error:", error);
    return NextResponse.json(
      { message: "Failed to retry provisioning", status: false },
      { status: 500 },
    );
  }
}
