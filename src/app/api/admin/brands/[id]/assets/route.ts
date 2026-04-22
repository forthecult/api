import { createId } from "@paralleldrive/cuid2";
import { eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { brandAssetTable, brandTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id: brandId } = await params;
    const [brand] = await db
      .select({ id: brandTable.id })
      .from(brandTable)
      .where(eq(brandTable.id, brandId))
      .limit(1);

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      sortOrder?: number;
      type?: string;
      url: string;
    };

    if (typeof body.url !== "string" || !body.url.trim()) {
      return NextResponse.json(
        { error: "url is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    const assetId = createId();
    const [maxRow] = await db
      .select({
        maxOrder: sql<null | number>`max(${brandAssetTable.sortOrder})::int`,
      })
      .from(brandAssetTable)
      .where(eq(brandAssetTable.brandId, brandId));

    const nextOrder = Number.isFinite(body.sortOrder)
      ? Number(body.sortOrder)
      : (maxRow?.maxOrder ?? -1) + 1;

    await db.insert(brandAssetTable).values({
      brandId,
      id: assetId,
      sortOrder: nextOrder,
      type: (body.type?.trim() || "other").slice(0, 32),
      url: body.url.trim(),
    });

    return NextResponse.json(
      {
        brandId,
        id: assetId,
        sortOrder: nextOrder,
        type: body.type?.trim() || "other",
        url: body.url.trim(),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Admin brand asset add error:", err);
    return NextResponse.json(
      { error: "Failed to add brand asset" },
      { status: 500 },
    );
  }
}
