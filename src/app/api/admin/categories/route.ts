import { asc, desc, ilike, inArray, or, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  categoriesTable,
  categoryTokenGateTable,
  productCategoriesTable,
} from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

/** Escape SQL LIKE/ILIKE special characters */
function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, (c) => `\\${c}`);
}

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const SORT_BY_VALUES = ["name", "products", "createdAt"] as const;
type SortBy = (typeof SORT_BY_VALUES)[number];
const ORDER_VALUES = ["asc", "desc"] as const;
type Order = (typeof ORDER_VALUES)[number];

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
    const { order, sortBy } = parseSort(
      request.nextUrl.searchParams.get("sortBy"),
      request.nextUrl.searchParams.get("order"),
    );

    const whereClause =
      search.length > 0
        ? or(
            ilike(categoriesTable.name, `%${escapeLike(search)}%`),
            ilike(categoriesTable.slug, `%${escapeLike(search)}%`),
          )
        : undefined;

    const orderBy =
      sortBy === "name"
        ? order === "asc"
          ? [asc(categoriesTable.name)]
          : [desc(categoriesTable.name)]
        : sortBy === "products"
          ? order === "asc"
            ? [
                asc(
                  sql`(SELECT count(*)::int FROM product_category WHERE category_id = ${categoriesTable.id})`,
                ),
              ]
            : [
                desc(
                  sql`(SELECT count(*)::int FROM product_category WHERE category_id = ${categoriesTable.id})`,
                ),
              ]
          : order === "asc"
            ? [asc(categoriesTable.createdAt)]
            : [desc(categoriesTable.createdAt)];

    const [categories, countResult, productCounts] = await Promise.all([
      db.query.categoriesTable.findMany({
        columns: {
          featured: true,
          id: true,
          imageUrl: true,
          level: true,
          name: true,
          parentId: true,
          slug: true,
          visible: true,
        },
        limit,
        offset,
        orderBy,
        where: whereClause,
      }),
      whereClause !== undefined
        ? db
            .select({ count: sql<number>`count(*)::int` })
            .from(categoriesTable)
            .where(whereClause)
        : db
            .select({ count: sql<number>`count(*)::int` })
            .from(categoriesTable),
      db
        .select({
          categoryId: productCategoriesTable.categoryId,
          count: sql<number>`count(*)::int`.as("count"),
        })
        .from(productCategoriesTable)
        .groupBy(productCategoriesTable.categoryId),
    ]);

    const totalCount = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const countByCategory = new Map(
      productCounts.map((r) => [r.categoryId, r.count]),
    );

    const parentIds = [
      ...new Set(categories.map((c) => c.parentId).filter(Boolean)),
    ] as string[];
    const parentNames = new Map<string, string>();
    if (parentIds.length > 0) {
      const parents = await db
        .select({ id: categoriesTable.id, name: categoriesTable.name })
        .from(categoriesTable)
        .where(inArray(categoriesTable.id, parentIds));
      for (const p of parents) {
        parentNames.set(p.id, p.name);
      }
    }

    const items = categories.map((c) => {
      // When category has a parent, expose parent name so dropdowns can show "Parent → Child"
      const parentName = c.parentId
        ? (parentNames.get(c.parentId) ?? null)
        : null;
      return {
        featured: c.featured,
        id: c.id,
        imageUrl: c.imageUrl,
        level: c.level,
        name: c.name,
        parentName: parentName ?? undefined,
        productCount: countByCategory.get(c.id) ?? 0,
        slug: c.slug,
        visible: c.visible ?? true,
      };
    });

    return NextResponse.json({
      items,
      limit,
      page,
      totalCount,
      totalPages,
    });
  } catch (err) {
    console.error("Admin categories list error:", err);
    return NextResponse.json(
      { error: "Failed to load categories" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const body = (await request.json()) as {
      description?: null | string;
      featured?: boolean;
      imageUrl?: null | string;
      level?: number;
      metaDescription?: null | string;
      name: string;
      parentId?: null | string;
      seoOptimized?: boolean;
      slug?: null | string;
      title?: null | string;
      tokenGateContractAddress?: null | string;
      tokenGated?: boolean;
      tokenGateNetwork?: null | string;
      tokenGateQuantity?: null | number;
      tokenGates?: {
        contractAddress?: null | string;
        id?: string;
        network?: null | string;
        quantity: number;
        tokenSymbol: string;
      }[];
      tokenGateType?: null | string;
      visible?: boolean;
    };

    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { error: "name is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    const now = new Date();
    const id = crypto.randomUUID();
    const hasTokenGates =
      Array.isArray(body.tokenGates) && body.tokenGates.length > 0;

    await db.insert(categoriesTable).values({
      createdAt: now,
      description: body.description?.trim() ?? null,
      featured: body.featured ?? false,
      id,
      imageUrl: body.imageUrl?.trim() ?? null,
      level: Math.max(1, Math.min(99, body.level ?? 1)),
      metaDescription: body.metaDescription?.trim() ?? null,
      name: body.name.trim(),
      parentId: body.parentId?.trim() || null,
      seoOptimized: body.seoOptimized ?? false,
      slug: body.slug?.trim() ?? null,
      title: body.title?.trim() ?? null,
      tokenGateContractAddress: body.tokenGateContractAddress ?? null,
      tokenGated: hasTokenGates || (body.tokenGated ?? false),
      tokenGateNetwork: body.tokenGateNetwork ?? null,
      tokenGateQuantity: body.tokenGateQuantity ?? null,
      tokenGateType: body.tokenGateType ?? null,
      updatedAt: now,
      visible: body.visible ?? true,
    });

    if (hasTokenGates) {
      for (const gate of body.tokenGates!) {
        const symbol = String(gate.tokenSymbol ?? "")
          .trim()
          .toUpperCase();
        const qty = Number(gate.quantity);
        if (!symbol || !Number.isInteger(qty) || qty < 1) continue;
        await db.insert(categoryTokenGateTable).values({
          categoryId: id,
          contractAddress: gate.contractAddress?.trim() || null,
          id: gate.id ?? crypto.randomUUID(),
          network: gate.network?.trim() || null,
          quantity: qty,
          tokenSymbol: symbol,
        });
      }
    }

    return NextResponse.json({ id, name: body.name.trim() }, { status: 201 });
  } catch (err) {
    console.error("Admin category create error:", err);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 },
    );
  }
}

function parseSort(
  sortByParam: null | string,
  orderParam: null | string,
): { order: Order; sortBy: SortBy } {
  const sortBy = SORT_BY_VALUES.includes(sortByParam as SortBy)
    ? (sortByParam as SortBy)
    : "createdAt";
  const order = ORDER_VALUES.includes(orderParam as Order)
    ? (orderParam as Order)
    : "desc";
  return { order, sortBy };
}
