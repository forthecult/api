import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { brandAssetTable } from "~/db/schema";
import { auth, isAdminUser } from "~/lib/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: _request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: brandId, assetId } = await params;
    const deletedRows = await db
      .delete(brandAssetTable)
      .where(
        and(
          eq(brandAssetTable.id, assetId),
          eq(brandAssetTable.brandId, brandId),
        ),
      )
      .returning({ id: brandAssetTable.id });

    if (deletedRows.length === 0) {
      return NextResponse.json(
        { error: "Brand or asset not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ deleted: assetId });
  } catch (err) {
    console.error("Admin brand asset delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete brand asset" },
      { status: 500 },
    );
  }
}
