import { desc, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { orderItemsTable, ordersTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";

function paymentStatusFromLegacy(status: string): string {
  if (status === "refunded") return "refunded";
  if (status === "paid" || status === "fulfilled") return "paid";
  if (status === "cancelled") return "cancelled";
  return "pending";
}

function fulfillmentStatusFromLegacy(status: string): string {
  if (status === "fulfilled") return "fulfilled";
  return "unfulfilled";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: customerId } = await params;
    const orders = await db
      .select({
        id: ordersTable.id,
        createdAt: ordersTable.createdAt,
        email: ordersTable.email,
        status: ordersTable.status,
        paymentStatus: ordersTable.paymentStatus,
        fulfillmentStatus: ordersTable.fulfillmentStatus,
        totalCents: ordersTable.totalCents,
      })
      .from(ordersTable)
      .where(eq(ordersTable.userId, customerId))
      .orderBy(desc(ordersTable.createdAt));

    const orderIds = orders.map((o) => o.id);
    const items =
      orderIds.length > 0
        ? await db
            .select({
              orderId: orderItemsTable.orderId,
              id: orderItemsTable.id,
              name: orderItemsTable.name,
              priceCents: orderItemsTable.priceCents,
              quantity: orderItemsTable.quantity,
            })
            .from(orderItemsTable)
            .where(inArray(orderItemsTable.orderId, orderIds))
        : [];

    const itemsByOrder = new Map<string, typeof items>();
    for (const i of items) {
      const list = itemsByOrder.get(i.orderId) ?? [];
      list.push(i);
      itemsByOrder.set(i.orderId, list);
    }
    const itemCountByOrder = new Map<string, number>();
    for (const i of items) {
      itemCountByOrder.set(
        i.orderId,
        (itemCountByOrder.get(i.orderId) ?? 0) + i.quantity,
      );
    }

    const result = orders.map((o) => {
      const orderItems = itemsByOrder.get(o.id) ?? [];
      const itemCount = itemCountByOrder.get(o.id) ?? 0;
      const payment = o.paymentStatus ?? paymentStatusFromLegacy(o.status);
      const fulfillment =
        o.fulfillmentStatus ?? fulfillmentStatusFromLegacy(o.status);
      return {
        id: o.id,
        createdAt: o.createdAt.toISOString(),
        email: o.email,
        status: o.status,
        paymentStatus: payment,
        fulfillmentStatus: fulfillment,
        totalCents: o.totalCents,
        itemCount,
        items: orderItems.map((i) => ({
          id: i.id,
          name: i.name,
          priceCents: i.priceCents,
          quantity: i.quantity,
        })),
      };
    });

    return NextResponse.json({ orders: result });
  } catch (err) {
    console.error("Admin customer orders error:", err);
    return NextResponse.json(
      { error: "Failed to load customer orders" },
      { status: 500 },
    );
  }
}
