import { and, desc, gte, inArray, lte, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { orderItemsTable, ordersTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

type Range = "daily" | "monthly" | "yearly";

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const range = (request.nextUrl.searchParams.get("range") ??
      "monthly") as Range;
    if (!["daily", "monthly", "yearly"].includes(range)) {
      return NextResponse.json({ error: "Invalid range" }, { status: 400 });
    }

    const { end, start } = getRangeBounds(range);

    const rangeCondition = and(
      gte(ordersTable.createdAt, start),
      lte(ordersTable.createdAt, end),
      inArray(ordersTable.status, ["paid", "fulfilled"]),
    );

    // Use aggregate queries instead of fetching all rows
    const [statsResult, soldItemsResult] = await Promise.all([
      db
        .select({
          orderCount: sql<number>`COUNT(*)::int`,
          totalSalesCents: sql<number>`COALESCE(SUM(${ordersTable.totalCents}), 0)::bigint`,
        })
        .from(ordersTable)
        .where(rangeCondition),
      db
        .select({
          soldItems: sql<number>`COALESCE(SUM(${orderItemsTable.quantity}), 0)::bigint`,
        })
        .from(orderItemsTable)
        .innerJoin(
          ordersTable,
          and(
            sql`${orderItemsTable.orderId} = ${ordersTable.id}`,
            rangeCondition,
          ),
        ),
    ]);

    const totalSalesCents = Number(statsResult[0]?.totalSalesCents ?? 0);
    const orderCount = Number(statsResult[0]?.orderCount ?? 0);
    const averageOrderValueCents =
      orderCount > 0 ? Math.round(totalSalesCents / orderCount) : 0;
    const soldItems = Number(soldItemsResult[0]?.soldItems ?? 0);

    // Fetch only the 10 most recent orders for the detail list
    const recentOrderRows = await db
      .select({
        createdAt: ordersTable.createdAt,
        email: ordersTable.email,
        id: ordersTable.id,
        status: ordersTable.status,
        totalCents: ordersTable.totalCents,
      })
      .from(ordersTable)
      .where(rangeCondition)
      .orderBy(desc(ordersTable.createdAt))
      .limit(10);

    const recentOrderIds = recentOrderRows.map((o) => o.id);
    const recentItems =
      recentOrderIds.length > 0
        ? await db
            .select({
              id: orderItemsTable.id,
              name: orderItemsTable.name,
              orderId: orderItemsTable.orderId,
              priceCents: orderItemsTable.priceCents,
              quantity: orderItemsTable.quantity,
            })
            .from(orderItemsTable)
            .where(inArray(orderItemsTable.orderId, recentOrderIds))
        : [];

    const itemsByOrderId = new Map<string, typeof recentItems>();
    for (const i of recentItems) {
      const list = itemsByOrderId.get(i.orderId) ?? [];
      list.push(i);
      itemsByOrderId.set(i.orderId, list);
    }

    const recentOrders = recentOrderRows.map((o) => ({
      createdAt:
        o.createdAt instanceof Date
          ? o.createdAt.toISOString()
          : String(o.createdAt),
      email: o.email,
      id: o.id,
      items: (itemsByOrderId.get(o.id) ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        priceCents: i.priceCents,
        quantity: i.quantity,
      })),
      status: o.status,
      totalCents: o.totalCents,
    }));

    return NextResponse.json({
      averageOrderValueCents,
      grossSaleCents: totalSalesCents,
      marketShare: 0,
      orderCount,
      productShare: 0,
      recentOrders,
      soldItems,
      stockOutProducts: [],
      totalSalesCents,
      totalShippingCents: 0,
      visits: 0,
      weeklySalesCents: 0,
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

function getRangeBounds(range: Range): { end: Date; start: Date } {
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
  return { end, start };
}
