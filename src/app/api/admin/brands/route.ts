import { asc, desc, ilike, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { brandTable } from "~/db/schema";
import { auth, isAdminUser } from "~/lib/auth";
import { createId } from "@paralleldrive/cuid2";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const SORT_BY_VALUES = ["name", "createdAt"] as const;
type SortBy = (typeof SORT_BY_VALUES)[number];
const ORDER_VALUES = ["asc", "desc"] as const;
type Order = (typeof ORDER_VALUES)[number];

function parseSort(
  sortByParam: string | null,
  orderParam: string | null,
): { sortBy: SortBy; order: Order } {
  const sortBy = SORT_BY_VALUES.includes(sortByParam as SortBy)
    ? (sortByParam as SortBy)
    : "createdAt";
  const order = ORDER_VALUES.includes(orderParam as Order)
    ? (orderParam as Order)
    : "desc";
  return { sortBy, order };
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const page = Math.max(
      1,
      Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10),
    );
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        Number.parseInt(
          request.nextUrl.searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE),
          10,
        ),
      ),
    );
    const offset = (page - 1) * limit;
    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const { sortBy, order } = parseSort(
      request.nextUrl.searchParams.get("sortBy"),
      request.nextUrl.searchParams.get("order"),
    );

    const whereClause =
      search.length > 0 ? ilike(brandTable.name, `%${search}%`) : undefined;

    const orderBy =
      sortBy === "name"
        ? order === "asc"
          ? asc(brandTable.name)
          : desc(brandTable.name)
        : order === "asc"
          ? asc(brandTable.createdAt)
          : desc(brandTable.createdAt);

    const [brands, countResult] = await Promise.all([
      db.query.brandTable.findMany({
        where: whereClause,
        orderBy,
        columns: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          websiteUrl: true,
          description: true,
          featured: true,
          createdAt: true,
        },
        limit,
        offset,
      }),
      whereClause !== undefined
        ? db
            .select({ count: sql<number>`count(*)::int` })
            .from(brandTable)
            .where(whereClause)
        : db.select({ count: sql<number>`count(*)::int` }).from(brandTable),
    ]);

    const totalCount = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    return NextResponse.json({
      items: brands,
      page,
      limit,
      totalCount,
      totalPages,
    });
  } catch (err) {
    console.error("Admin brands list error:", err);
    return NextResponse.json(
      { error: "Failed to load brands" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      name: string;
      slug?: string | null;
      logoUrl?: string | null;
      websiteUrl?: string | null;
      description?: string | null;
      featured?: boolean;
    };

    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { error: "name is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    const name = body.name.trim();
    const slug =
      (typeof body.slug === "string" && body.slug.trim()) || slugFromName(name);

    const id = createId();
    const now = new Date();

    await db.insert(brandTable).values({
      id,
      name,
      slug,
      logoUrl: body.logoUrl?.trim() ?? null,
      websiteUrl: body.websiteUrl?.trim() ?? null,
      description: body.description?.trim() ?? null,
      featured: body.featured ?? false,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      { id, name, slug },
      { status: 201 },
    );
  } catch (err) {
    console.error("Admin brand create error:", err);
    return NextResponse.json(
      { error: "Failed to create brand" },
      { status: 500 },
    );
  }
}
