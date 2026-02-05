import { eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  addressesTable,
  ordersTable,
  supportTicketTable,
  wishlistTable,
} from "~/db/schema";
import { auth } from "~/lib/auth";

/**
 * Returns counts for the current user's dashboard sidebar (orders, wishlist, addresses, support tickets).
 * Payment methods is a placeholder (0) until that feature exists.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const [ordersRow, wishlistRow, addressesRow, supportTicketsRow] =
      await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(ordersTable)
          .where(eq(ordersTable.userId, userId)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(wishlistTable)
          .where(eq(wishlistTable.userId, userId)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(addressesTable)
          .where(eq(addressesTable.userId, userId)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(supportTicketTable)
          .where(eq(supportTicketTable.userId, userId)),
      ]);

    return NextResponse.json({
      orders: ordersRow[0]?.count ?? 0,
      wishlist: wishlistRow[0]?.count ?? 0,
      addresses: addressesRow[0]?.count ?? 0,
      supportTickets: supportTicketsRow[0]?.count ?? 0,
      paymentMethods: 0,
    });
  } catch (err) {
    console.error("Dashboard counts error:", err);
    return NextResponse.json(
      { error: "Failed to load counts" },
      { status: 500 },
    );
  }
}
