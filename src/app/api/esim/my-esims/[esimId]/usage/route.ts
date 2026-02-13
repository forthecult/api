import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCurrentUser } from "~/lib/auth";
import { db } from "~/db";
import { esimOrdersTable } from "~/db/schema";
import { getEsimUsage } from "~/lib/esim-api";

/**
 * GET /api/esim/my-esims/[esimId]/usage
 * Get data usage for a specific eSIM.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ esimId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { status: false, message: "Authentication required" },
        { status: 401 },
      );
    }

    const { esimId } = await params;

    // Get our local order record
    const [order] = await db
      .select()
      .from(esimOrdersTable)
      .where(
        and(
          eq(esimOrdersTable.id, esimId),
          eq(esimOrdersTable.userId, user.id),
        ),
      )
      .limit(1);

    if (!order) {
      return NextResponse.json(
        { status: false, message: "eSIM order not found" },
        { status: 404 },
      );
    }

    if (!order.esimId) {
      return NextResponse.json(
        { status: false, message: "eSIM not yet provisioned" },
        { status: 400 },
      );
    }

    const result = await getEsimUsage(order.esimId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("eSIM usage error:", error);
    return NextResponse.json(
      { status: false, message: "Failed to fetch eSIM usage" },
      { status: 500 },
    );
  }
}
