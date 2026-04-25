import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { esimOrdersTable } from "~/db/schema";
import { getCurrentUser } from "~/lib/auth";
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
        { message: "Authentication required", status: false },
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
        { message: "eSIM order not found", status: false },
        { status: 404 },
      );
    }

    if (!order.esimId) {
      return NextResponse.json(
        { message: "eSIM not yet provisioned", status: false },
        { status: 400 },
      );
    }

    const result = await getEsimUsage(order.esimId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("eSIM usage error:", error);
    return NextResponse.json(
      { message: "Failed to fetch eSIM usage", status: false },
      { status: 500 },
    );
  }
}
