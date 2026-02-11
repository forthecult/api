import { asc } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { pageTokenGateTable } from "~/db/schema";
import {
  adminAuthFailureResponse,
  getAdminAuth,
} from "~/lib/admin-api-auth";

/**
 * GET /api/admin/token-gate/pages
 * Returns list of page slugs that have token gates (for admin navigation).
 */
export async function GET(_request: NextRequest) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const slugs = await db
      .selectDistinct({
        pageSlug: pageTokenGateTable.pageSlug,
      })
      .from(pageTokenGateTable)
      .orderBy(asc(pageTokenGateTable.pageSlug));

    return NextResponse.json({
      slugs: slugs.map((s) => s.pageSlug),
    });
  } catch (err) {
    console.error("Admin page token gates list error:", err);
    return NextResponse.json(
      { error: "Failed to list page token gates" },
      { status: 500 },
    );
  }
}
