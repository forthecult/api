import { and, desc, gte, inArray, lte } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { orderItemsTable, ordersTable } from "~/db/schema";
import { auth, isAdminUser } from "~/lib/auth";

type Range = "daily" | "monthly" | "yearly";

function getRangeBounds(range: Range): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  if (range === "daily") {
    start.setHours(0, 0, 0, 0);
  } else if (range === "monthly") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const range = (request.nextUrl.searchParams.get("range") ??
      "monthly") as Range;
    if (!["daily", "monthly", "yearly"].includes(range)) {
      return NextResponse.json({ error: "Invalid range" }, { status: 400 });
    }

    const { start, end } = getRangeBounds(range);

    const orders = await db
      .select({
        id: ordersTable.id,
        createdAt: ordersTable.createdAt,
        email: ordersTable.email,
        status: ordersTable.status,
        totalCents: ordersTable.totalCents,
      })
      .from(ordersTable)
      .where(
        and(
          gte(ordersTable.createdAt, start),
          lte(ordersTable.createdAt, end),
          inArray(ordersTable.status, ["paid", "fulfilled"]),
        ),
      )
      .orderBy(desc(ordersTable.createdAt));

    const orderIds = orders.map((o) => o.id);
    const items =
      orderIds.length > 0
        ? await db
            .select({
              id: orderItemsTable.id,
              name: orderItemsTable.name,
              priceCents: orderItemsTable.priceCents,
              quantity: orderItemsTable.quantity,
              orderId: orderItemsTable.orderId,
            })
            .from(orderItemsTable)
            .where(inArray(orderItemsTable.orderId, orderIds))
        : [];

    const itemsByOrderId = new Map<string, typeof items>();
    for (const i of items) {
      const list = itemsByOrderId.get(i.orderId) ?? [];
      list.push(i);
      itemsByOrderId.set(i.orderId, list);
    }

    const totalSalesCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
    const orderCount = orders.length;
    const averageOrderValueCents =
      orderCount > 0 ? Math.round(totalSalesCents / orderCount) : 0;
    const soldItems = items.reduce((sum, i) => sum + i.quantity, 0);

    const recentOrders = orders.slice(0, 10).map((o) => ({
      id: o.id,
      createdAt:
        o.createdAt instanceof Date
          ? o.createdAt.toISOString()
          : String(o.createdAt),
      email: o.email,
      status: o.status,
      totalCents: o.totalCents,
      items: (itemsByOrderId.get(o.id) ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        priceCents: i.priceCents,
        quantity: i.quantity,
      })),
    }));

    return NextResponse.json({
      visits: 0,
      totalSalesCents,
      averageOrderValueCents,
      orderCount,
      soldItems,
      grossSaleCents: totalSalesCents,
      totalShippingCents: 0,
      weeklySalesCents: 0,
      productShare: 0,
      marketShare: 0,
      recentOrders,
      stockOutProducts: [],
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    const message = err instanceof Error ? err.message : "";
    const hint =
      message && /column.*does not exist|Unknown column/i.test(message)
        ? " Run: bun run db:push to sync schema."
        : "";
    return NextResponse.json(
      {
        error: "Failed to load dashboard stats",
        ...(process.env.NODE_ENV === "development" && message
          ? { detail: message + hint }
          : {}),
      },
      { status: 500 },
    );
  }
}
