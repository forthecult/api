import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { esimOrdersTable } from "~/db/schema";
import { getCurrentUser } from "~/lib/auth";

/**
 * GET /api/esim/my-esims
 * Get the authenticated user's eSIM purchases.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { message: "Authentication required", status: false },
        { status: 401 },
      );
    }

    const orders = await db
      .select()
      .from(esimOrdersTable)
      .where(eq(esimOrdersTable.userId, user.id))
      .orderBy(desc(esimOrdersTable.createdAt));

    return NextResponse.json({ data: orders, status: true });
  } catch (error) {
    console.error("eSIM my-esims error:", error);
    return NextResponse.json(
      { message: "Failed to fetch your eSIMs", status: false },
      { status: 500 },
    );
  }
}
