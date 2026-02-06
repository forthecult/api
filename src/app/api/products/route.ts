import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { getAllCategorySlugsAndNames } from "~/lib/categories";
import {
  categoriesTable,
  orderItemsTable,
  productCategoriesTable,
  productsTable,
} from "~/db/schema";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 48;

function isMissingTableError(err: unknown): boolean {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code: string }).code
      : (err as { cause?: { code?: string } })?.cause?.code;
  return code === "42P01";
}

export type ProductsSort =
  | "newest"
  | "price_asc"
  | "price_desc"
  | "best_selling"
  | "rating";

/**
 * Public API: returns only published products for the storefront.
 * Query: page, limit, category (optional).
 * No auth required. Cached for 60s.
 */
export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(
      1,
      Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
    );
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(
        1,
        Number.parseInt(
          searchParams.get("limit") ?? String(DEFAULT_LIMIT),
          10,
        ) || DEFAULT_LIMIT,
      ),
    );
    const category = searchParams.get("category")?.trim() || null;
    const subcategory = searchParams.get("subcategory")?.trim() || null;
    const sortParam = (searchParams.get("sort")?.trim() || "newest") as ProductsSort;
    const sort: ProductsSort =
      ["newest", "price_asc", "price_desc", "best_selling", "rating"].includes(
        sortParam,
      )
        ? sortParam
        : "newest";
    const offset = (page - 1) * limit;

    const categorySlugToFilter = subcategory || category;

    let productIdsFilter: string[] | null = null;
    if (categorySlugToFilter) {
      // Include all products in this category (main or not), so bulk-added / auto-assigned products show
      const rows = await db
        .select({ productId: productCategoriesTable.productId })
        .from(productCategoriesTable)
        .innerJoin(
          categoriesTable,
          eq(productCategoriesTable.categoryId, categoriesTable.id),
        )
        .where(eq(categoriesTable.slug, categorySlugToFilter));
      productIdsFilter = rows.map((r) => r.productId);
      if (productIdsFilter.length === 0) {
        return NextResponse.json({
          items: [],
          total: 0,
          page: 1,
          limit,
          totalPages: 0,
          categories: await getAllCategorySlugsAndNames(),
        });
      }
    }

    const whereClause =
      productIdsFilter === null
        ? eq(productsTable.published, true)
        : and(
            eq(productsTable.published, true),
            inArray(productsTable.id, productIdsFilter),
          );

    const orderBy =
      sort === "price_asc"
        ? [asc(productsTable.priceCents), desc(productsTable.createdAt)]
        : sort === "price_desc"
          ? [desc(productsTable.priceCents), desc(productsTable.createdAt)]
          : [desc(productsTable.createdAt)];

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(productsTable)
      .where(whereClause);

    let rows: Awaited<
      ReturnType<typeof db.query.productsTable.findMany>
    >;
    if (sort === "best_selling") {
      const soldSubq = db
        .select({
          productId: orderItemsTable.productId,
          qty: sql<number>`sum(${orderItemsTable.quantity})::int`.as("qty"),
        })
        .from(orderItemsTable)
        .where(sql`${orderItemsTable.productId} is not null`)
        .groupBy(orderItemsTable.productId)
        .as("sold");
      const idsQuery = db
        .select({ id: productsTable.id })
        .from(productsTable)
        .leftJoin(soldSubq, eq(productsTable.id, soldSubq.productId))
        .where(whereClause)
        .orderBy(
          sql`${soldSubq.qty} desc nulls last`,
          desc(productsTable.createdAt),
        )
        .limit(limit)
        .offset(offset);
      const orderedIds = await idsQuery;
      const ids = orderedIds.map((r) => r.id);
      if (ids.length === 0) {
        rows = [];
      } else {
        const found = await db.query.productsTable.findMany({
          where: inArray(productsTable.id, ids),
          with: {
            productCategories: {
              with: { category: true },
            },
          },
        });
        const orderMap = new Map(ids.map((id, i) => [id, i]));
        rows = found.sort(
          (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
        );
      }
    } else {
      rows = await db.query.productsTable.findMany({
        where: whereClause,
        orderBy,
        limit,
        offset,
        with: {
          productCategories: {
            with: { category: true },
          },
        },
      } as Parameters<typeof db.query.productsTable.findMany>[0]);
    }

    const categoryNames = await getAllCategorySlugsAndNames();

    const total = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;

    type ProductWithRelations = (typeof rows)[number] & {
      productCategories?: Array<{ isMain?: boolean; category?: { name?: string; slug?: string } }>;
    };
    const items = rows.map((p: ProductWithRelations) => {
      const mainPc =
        p.productCategories?.find((pc: { isMain?: boolean }) => pc.isMain) ??
        p.productCategories?.[0];
      return {
        id: p.id,
        slug: p.slug ?? undefined,
        name: p.name,
        image: p.imageUrl ?? "/placeholder.svg",
        category: mainPc?.category?.name ?? "Uncategorized",
        categorySlug: mainPc?.category?.slug ?? undefined,
        price: p.priceCents / 100,
        originalPrice:
          p.compareAtPriceCents != null
            ? p.compareAtPriceCents / 100
            : undefined,
        inStock: true,
        rating: 0,
      };
    });

    return NextResponse.json(
      {
        items,
        total,
        page,
        limit,
        totalPages,
        categories: categoryNames,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (err) {
    console.error("Public products list error:", err);
    if (isMissingTableError(err)) {
      const { searchParams } = request.nextUrl;
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(
          1,
          Number.parseInt(
            searchParams.get("limit") ?? String(DEFAULT_LIMIT),
            10,
          ) || DEFAULT_LIMIT,
        ),
      );
      return NextResponse.json(
        {
          items: [],
          total: 0,
          page: 1,
          limit,
          totalPages: 0,
          categories: [],
        },
        {
          headers: {
            "Cache-Control":
              "public, s-maxage=60, stale-while-revalidate=120",
          },
        },
      );
    }
    return NextResponse.json(
      { error: "Failed to load products" },
      { status: 500 },
    );
  }
}

/** All categories with slug (for filter dropdown and category pages). */
