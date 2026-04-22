import { isNotNull } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { productsTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

/**
 * GET /api/admin/products/vendors
 * Returns distinct vendor names for product list filter.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const rows = await db
      .selectDistinct({ vendor: productsTable.vendor })
      .from(productsTable)
      .where(isNotNull(productsTable.vendor))
      .orderBy(productsTable.vendor);

    const vendors = rows
      .map((r) => r.vendor)
      .filter((v): v is string => v != null && v.trim() !== "");

    return NextResponse.json({ vendors });
  } catch (err) {
    console.error("Admin products vendors list error:", err);
    return NextResponse.json(
      { error: "Failed to load vendors" },
      { status: 500 },
    );
  }
}
