import { asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { brandAssetTable, brandTable } from "~/db/schema";
import { auth, isAdminUser } from "~/lib/auth";

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: _request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const [brand] = await db
      .select()
      .from(brandTable)
      .where(eq(brandTable.id, id))
      .limit(1);

    if (!brand) {
      return NextResponse.json(
        { error: "Brand not found" },
        { status: 404 },
      );
    }

    const assets = await db
      .select({
        id: brandAssetTable.id,
        url: brandAssetTable.url,
        type: brandAssetTable.type,
        sortOrder: brandAssetTable.sortOrder,
      })
      .from(brandAssetTable)
      .where(eq(brandAssetTable.brandId, id))
      .orderBy(asc(brandAssetTable.sortOrder), asc(brandAssetTable.createdAt));

    return NextResponse.json({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logoUrl: brand.logoUrl,
      websiteUrl: brand.websiteUrl,
      description: brand.description,
      featured: brand.featured,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
      assets,
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
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = (await request.json()) as {
      name?: string;
      slug?: string | null;
      logoUrl?: string | null;
      websiteUrl?: string | null;
      description?: string | null;
      featured?: boolean;
      assets?: Array<{
        id?: string;
        url: string;
        type?: string;
        sortOrder?: number;
      }>;
    };

    const [existing] = await db
      .select()
      .from(brandTable)
      .where(eq(brandTable.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Brand not found" },
        { status: 404 },
      );
    }

    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : existing.name;
    const slug =
      (typeof body.slug === "string" && body.slug.trim()) || slugFromName(name);

    await db
      .update(brandTable)
      .set({
        name,
        slug,
        logoUrl:
          body.logoUrl !== undefined
            ? (body.logoUrl?.trim() ?? null)
            : existing.logoUrl,
        websiteUrl:
          body.websiteUrl !== undefined
            ? (body.websiteUrl?.trim() ?? null)
            : existing.websiteUrl,
        description:
          body.description !== undefined
            ? (body.description?.trim() ?? null)
            : existing.description,
        featured: body.featured ?? existing.featured,
        updatedAt: new Date(),
      })
      .where(eq(brandTable.id, id));

    if (Array.isArray(body.assets)) {
      await db.delete(brandAssetTable).where(eq(brandAssetTable.brandId, id));
      const { createId } = await import("@paralleldrive/cuid2");
      for (let i = 0; i < body.assets.length; i++) {
        const a = body.assets[i];
        if (typeof a?.url !== "string" || !a.url.trim()) continue;
        await db.insert(brandAssetTable).values({
          id: a.id?.trim() || createId(),
          brandId: id,
          url: a.url.trim(),
          type: (a.type?.trim() || "other").slice(0, 32),
          sortOrder: Number.isFinite(a.sortOrder) ? Number(a.sortOrder) : i,
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: _request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const [existing] = await db
      .select({ id: brandTable.id })
      .from(brandTable)
      .where(eq(brandTable.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Brand not found" },
        { status: 404 },
      );
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
