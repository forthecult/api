import { asc } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { pageTokenGateTable } from "~/db/schema";
import { auth, isAdminUser } from "~/lib/auth";

/**
 * GET /api/admin/token-gate/pages
 * Returns list of page slugs that have token gates (for admin navigation).
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: _request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
