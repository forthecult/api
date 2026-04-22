import { asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { brandAssetTable, brandTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import { slugify } from "~/lib/slugify";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;
    const [existing] = await db
      .select({ id: brandTable.id })
      .from(brandTable)
      .where(eq(brandTable.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    await db.delete(brandTable).where(eq(brandTable.id, id));
    return NextResponse.json({ deleted: id });
  } catch (err) {
    console.error("Admin brand delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete brand" },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;
    const [brand] = await db
      .select()
      .from(brandTable)
      .where(eq(brandTable.id, id))
      .limit(1);

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const assets = await db
      .select({
        id: brandAssetTable.id,
        sortOrder: brandAssetTable.sortOrder,
        type: brandAssetTable.type,
        url: brandAssetTable.url,
      })
      .from(brandAssetTable)
      .where(eq(brandAssetTable.brandId, id))
      .orderBy(asc(brandAssetTable.sortOrder), asc(brandAssetTable.createdAt));

    return NextResponse.json({
      assets,
      createdAt: brand.createdAt,
      description: brand.description,
      featured: brand.featured,
      id: brand.id,
      logoUrl: brand.logoUrl,
      name: brand.name,
      slug: brand.slug,
      updatedAt: brand.updatedAt,
      websiteUrl: brand.websiteUrl,
    });
  } catch (err) {
    console.error("Admin brand get error:", err);
    return NextResponse.json(
      { error: "Failed to load brand" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;
    const body = (await request.json()) as {
      assets?: {
        id?: string;
        sortOrder?: number;
        type?: string;
        url: string;
      }[];
      description?: null | string;
      featured?: boolean;
      logoUrl?: null | string;
      name?: string;
      slug?: null | string;
      websiteUrl?: null | string;
    };

    const [existing] = await db
      .select()
      .from(brandTable)
      .where(eq(brandTable.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : existing.name;
    const slug =
      (typeof body.slug === "string" && body.slug.trim()) || slugify(name);

    await db
      .update(brandTable)
      .set({
        description:
          body.description !== undefined
            ? (body.description?.trim() ?? null)
            : existing.description,
        featured: body.featured ?? existing.featured,
        logoUrl:
          body.logoUrl !== undefined
            ? (body.logoUrl?.trim() ?? null)
            : existing.logoUrl,
        name,
        slug,
        updatedAt: new Date(),
        websiteUrl:
          body.websiteUrl !== undefined
            ? (body.websiteUrl?.trim() ?? null)
            : existing.websiteUrl,
      })
      .where(eq(brandTable.id, id));

    if (Array.isArray(body.assets)) {
      await db.delete(brandAssetTable).where(eq(brandAssetTable.brandId, id));
      const { createId } = await import("@paralleldrive/cuid2");
      for (let i = 0; i < body.assets.length; i++) {
        const a = body.assets[i];
        if (typeof a?.url !== "string" || !a.url.trim()) continue;
        await db.insert(brandAssetTable).values({
          brandId: id,
          id: a.id?.trim() || createId(),
          sortOrder: Number.isFinite(a.sortOrder) ? Number(a.sortOrder) : i,
          type: (a.type?.trim() || "other").slice(0, 32),
          url: a.url.trim(),
        });
      }
    }

    return NextResponse.json({ id, name, slug });
  } catch (err) {
    console.error("Admin brand update error:", err);
    return NextResponse.json(
      { error: "Failed to update brand" },
      { status: 500 },
    );
  }
}
