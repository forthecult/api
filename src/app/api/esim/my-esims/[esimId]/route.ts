import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCurrentUser } from "~/lib/auth";
import { db } from "~/db";
import { esimOrdersTable } from "~/db/schema";
import { getEsimDetail, getMyEsims } from "~/lib/esim-api";

/**
 * GET /api/esim/my-esims/[esimId]
 * Get details for a specific eSIM purchase including live status from the provider.
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

    // Try to get live details from eSIM Card API
    let liveDetail = null;
    if (order.esimId) {
      try {
        const result = await getEsimDetail(order.esimId);
        if (result.status) {
          liveDetail = result.data;
        }
      } catch {
        // API detail not available — continue with local data
      }
    }

    // If we don't have an esimId yet (async purchase), try to find it
    if (!order.esimId) {
      try {
        const esims = await getMyEsims();
        if (esims.status && esims.data.length > 0) {
          // Match by looking for latest eSIM (best effort for async purchases)
          const latest = esims.data[0];
          if (latest) {
            liveDetail = {
              sim: {
                id: latest.id,
                iccid: latest.iccid,
                status: latest.status,
                total_bundles: latest.total_bundles,
              },
              universal_link: latest.universal_link,
            };
          }
        }
      } catch {
        // Ignore
      }
    }

    return NextResponse.json({
      status: true,
      data: {
        order,
        liveDetail,
      },
    });
  } catch (error) {
    console.error("eSIM detail error:", error);
    return NextResponse.json(
      { status: false, message: "Failed to fetch eSIM details" },
      { status: 500 },
    );
  }
}
