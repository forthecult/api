import { createId } from "@paralleldrive/cuid2";
import { desc, ilike, or, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { blogPostTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const page = Math.max(
      1,
      Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10),
    );
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        Number.parseInt(
          request.nextUrl.searchParams.get("limit") ??
            String(DEFAULT_PAGE_SIZE),
          10,
        ),
      ),
    );
    const offset = (page - 1) * limit;
    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";

    const whereClause =
      search.length > 0
        ? or(
            ilike(blogPostTable.title, `%${escapeLike(search)}%`),
            ilike(blogPostTable.slug, `%${escapeLike(search)}%`),
            ilike(blogPostTable.authorDisplayName, `%${escapeLike(search)}%`),
          )
        : undefined;

    const [items, countResult] = await Promise.all([
      db.query.blogPostTable.findMany({
        columns: {
          authorDisplayName: true,
          authorId: true,
          coverImageUrl: true,
          createdAt: true,
          id: true,
          publishedAt: true,
          slug: true,
          tags: true,
          title: true,
          updatedAt: true,
        },
        limit,
        offset,
        orderBy: [desc(blogPostTable.createdAt)],
        where: whereClause,
      }),
      whereClause !== undefined
        ? db
            .select({ count: sql<number>`count(*)::int` })
            .from(blogPostTable)
            .where(whereClause)
        : db.select({ count: sql<number>`count(*)::int` }).from(blogPostTable),
    ]);

    const totalCount = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const itemsWithTags = items.map((row) => ({
      ...row,
      tags: parseTags(row.tags),
    }));

    return NextResponse.json({
      items: itemsWithTags,
      limit,
      page,
      totalCount,
      totalPages,
    });
  } catch (err) {
    console.error("Admin blog list error:", err);
    return NextResponse.json(
      { error: "Failed to load blog posts" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const body = (await request.json()) as {
      authorDisplayName?: null | string;
      authorId?: null | string;
      body: string;
      coverImageUrl?: null | string;
      metaDescription?: null | string;
      metaTitle?: null | string;
      publishedAt?: null | string;
      slug: string;
      summary?: null | string;
      tags?: null | string[];
      title: string;
    };

    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json(
        { error: "title is required and must be a non-empty string" },
        { status: 400 },
      );
    }
    if (typeof body.slug !== "string" || !body.slug.trim()) {
      return NextResponse.json(
        { error: "slug is required and must be a non-empty string" },
        { status: 400 },
      );
    }
    if (typeof body.body !== "string") {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    const now = new Date();
    const id = createId();
    const slug = body.slug.trim().toLowerCase().replace(/\s+/g, "-");
    const publishedAt = body.publishedAt
      ? parseDateTime(body.publishedAt)
      : null;

    await db.insert(blogPostTable).values({
      authorDisplayName: body.authorDisplayName?.trim() ?? null,
      authorId: body.authorId?.trim() || null,
      body: body.body,
      coverImageUrl: body.coverImageUrl?.trim() ?? null,
      createdAt: now,
      id,
      metaDescription: body.metaDescription?.trim() ?? null,
      metaTitle: body.metaTitle?.trim() ?? null,
      publishedAt,
      slug,
      summary: body.summary?.trim() ?? null,
      tags: serializeTags(body.tags),
      title: body.title.trim(),
      updatedAt: now,
    });

    return NextResponse.json(
      { id, slug, title: body.title.trim() },
      { status: 201 },
    );
  } catch (err) {
    console.error("Admin blog create error:", err);
    return NextResponse.json(
      { error: "Failed to create blog post" },
      { status: 500 },
    );
  }
}

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, (c) => `\\${c}`);
}

function parseDateTime(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

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
