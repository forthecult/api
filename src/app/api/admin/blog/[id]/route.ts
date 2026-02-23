import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { blogPostTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

function parseTags(value: null | string | undefined): string[] {
  if (value == null || value === "") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? (parsed as string[]).filter((t) => typeof t === "string")
      : [];
  } catch {
    return [];
  }
}

function serializeTags(tags: null | string[] | undefined): null | string {
  if (!Array.isArray(tags) || tags.length === 0) return null;
  const cleaned = tags.filter((t) => typeof t === "string" && t.trim());
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

function parseDateTime(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;
    const [row] = await db
      .select()
      .from(blogPostTable)
      .where(eq(blogPostTable.id, id))
      .limit(1);

    if (!row) {
      return NextResponse.json(
        { error: "Blog post not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ...row,
      tags: parseTags(row.tags),
    });
  } catch (err) {
    console.error("Admin blog get error:", err);
    return NextResponse.json(
      { error: "Failed to load blog post" },
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
      authorDisplayName?: null | string;
      authorId?: null | string;
      body?: string;
      coverImageUrl?: null | string;
      metaDescription?: null | string;
      metaTitle?: null | string;
      publishedAt?: null | string;
      slug?: string;
      summary?: null | string;
      tags?: null | string[];
      title?: string;
    };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.title === "string") updates.title = body.title.trim();
    if (typeof body.slug === "string")
      updates.slug = body.slug.trim().toLowerCase().replace(/\s+/g, "-");
    if (body.summary !== undefined) updates.summary = body.summary?.trim() ?? null;
    if (typeof body.body === "string") updates.body = body.body;
    if (body.coverImageUrl !== undefined)
      updates.coverImageUrl = body.coverImageUrl?.trim() ?? null;
    if (body.authorId !== undefined) updates.authorId = body.authorId?.trim() || null;
    if (body.authorDisplayName !== undefined)
      updates.authorDisplayName = body.authorDisplayName?.trim() ?? null;
    if (body.metaTitle !== undefined) updates.metaTitle = body.metaTitle?.trim() ?? null;
    if (body.metaDescription !== undefined)
      updates.metaDescription = body.metaDescription?.trim() ?? null;
    if (body.tags !== undefined) updates.tags = serializeTags(body.tags);
    if (body.publishedAt !== undefined)
      updates.publishedAt = body.publishedAt
        ? parseDateTime(body.publishedAt)
        : null;

    const [updated] = await db
      .update(blogPostTable)
      .set(updates as Record<string, unknown>)
      .where(eq(blogPostTable.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Blog post not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ...updated,
      tags: parseTags(updated.tags),
    });
  } catch (err) {
    console.error("Admin blog update error:", err);
    return NextResponse.json(
      { error: "Failed to update blog post" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;
    const [deleted] = await db
      .delete(blogPostTable)
      .where(eq(blogPostTable.id, id))
      .returning({ id: blogPostTable.id });

    if (!deleted) {
      return NextResponse.json(
        { error: "Blog post not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin blog delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete blog post" },
      { status: 500 },
    );
  }
}
