import { eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { brandAssetTable, brandTable } from "~/db/schema";
import { auth, isAdminUser } from "~/lib/auth";
import { createId } from "@paralleldrive/cuid2";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: brandId } = await params;
    const [brand] = await db
      .select({ id: brandTable.id })
      .from(brandTable)
      .where(eq(brandTable.id, brandId))
      .limit(1);

    if (!brand) {
      return NextResponse.json(
        { error: "Brand not found" },
        { status: 404 },
      );
    }

    const body = (await request.json()) as {
      url: string;
      type?: string;
      sortOrder?: number;
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
        maxOrder: sql<number | null>`max(${brandAssetTable.sortOrder})::int`,
      })
      .from(brandAssetTable)
      .where(eq(brandAssetTable.brandId, brandId));

    const nextOrder = Number.isFinite(body.sortOrder)
      ? Number(body.sortOrder)
      : (maxRow?.maxOrder ?? -1) + 1;

    await db.insert(brandAssetTable).values({
      id: assetId,
      brandId,
      url: body.url.trim(),
      type: (body.type?.trim() || "other").slice(0, 32),
      sortOrder: nextOrder,
    });

    return NextResponse.json(
      {
        id: assetId,
        brandId,
        url: body.url.trim(),
        type: body.type?.trim() || "other",
        sortOrder: nextOrder,
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
