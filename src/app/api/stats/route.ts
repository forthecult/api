import { and, eq, inArray, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  orderItemsTable,
  ordersTable,
  productsTable,
  supportChatConversationTable,
  supportTicketTable,
} from "~/db/schema";
import { auth } from "~/lib/auth";

/**
 * GET /api/stats
 * Returns store-level statistics for the token-gated /stats page.
 * Requires an authenticated session (page itself is token-gated).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const paidOrFulfilled = inArray(ordersTable.status, ["paid", "fulfilled"]);

    const [orders, orderItemsRows, supportTicketsRow, chatsRow] =
      await Promise.all([
        db
          .select({
            id: ordersTable.id,
            totalCents: ordersTable.totalCents,
          })
          .from(ordersTable)
          .where(paidOrFulfilled),
        db
          .select({
            name: orderItemsTable.name,
            quantity: orderItemsTable.quantity,
            productId: orderItemsTable.productId,
            slug: productsTable.slug,
          })
          .from(orderItemsTable)
          .innerJoin(
            ordersTable,
            and(eq(orderItemsTable.orderId, ordersTable.id), paidOrFulfilled),
          )
          .leftJoin(
            productsTable,
            eq(orderItemsTable.productId, productsTable.id),
          ),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(supportTicketTable),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(supportChatConversationTable),
      ]);

    const orderCount = orders.length;
    const totalSalesCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
    const averageOrderValueCents =
      orderCount > 0 ? Math.round(totalSalesCents / orderCount) : 0;
    const soldItems = orderItemsRows.reduce(
      (sum, row) => sum + row.quantity,
      0,
    );

    const byProduct = new Map<
      string,
      { name: string; quantity: number; slug: string | null }
    >();
    for (const row of orderItemsRows) {
      const id = row.productId ?? `name:${row.name}`;
      const existing = byProduct.get(id);
      if (existing) {
        existing.quantity += row.quantity;
      } else {
        byProduct.set(id, {
          name: row.name,
          quantity: row.quantity,
          slug: row.productId ? (row.slug ?? null) : null,
        });
      }
    }
    let mostPopularItem: {
      name: string;
      quantity: number;
      productId?: string;
      slug?: string | null;
    } | null = null;
    for (const [productId, entry] of byProduct) {
      if (!mostPopularItem || entry.quantity > mostPopularItem.quantity) {
        mostPopularItem = {
          name: entry.name,
          quantity: entry.quantity,
          ...(productId.startsWith("name:")
            ? {}
            : {
                productId,
                slug: entry.slug,
              }),
        };
      }
    }

    return NextResponse.json({
      orderCount,
      averageOrderValueCents,
      soldItems,
      mostPopularItem,
      supportTicketsCount: supportTicketsRow[0]?.count ?? 0,
      chatsCount: chatsRow[0]?.count ?? 0,
    });
  } catch (err) {
    console.error("Store stats error:", err);
    return NextResponse.json(
      { error: "Failed to load store stats" },
      { status: 500 },
    );
  }
}
