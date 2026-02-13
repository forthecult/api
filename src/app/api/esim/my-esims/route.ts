import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCurrentUser } from "~/lib/auth";
import { db } from "~/db";
import { esimOrdersTable } from "~/db/schema";

/**
 * GET /api/esim/my-esims
 * Get the authenticated user's eSIM purchases.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { status: false, message: "Authentication required" },
        { status: 401 },
      );
    }

    const orders = await db
      .select()
      .from(esimOrdersTable)
      .where(eq(esimOrdersTable.userId, user.id))
      .orderBy(desc(esimOrdersTable.createdAt));

    return NextResponse.json({ status: true, data: orders });
  } catch (error) {
    console.error("eSIM my-esims error:", error);
    return NextResponse.json(
      { status: false, message: "Failed to fetch your eSIMs" },
      { status: 500 },
    );
  }
}
