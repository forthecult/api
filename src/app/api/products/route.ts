import { and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import {
  publicApiCorsPreflight,
  withPublicApiCors,
} from "~/lib/cors-public-api";
import { db } from "~/db";
import { getCategoriesWithProductsAndDisplayImage } from "~/lib/categories";
import { formatTokenGateSummaryToDisplay } from "~/lib/token-gate";
import { hasValidTokenGateCookie } from "~/lib/token-gate-cookie";
import {
  categoriesTable,
  orderItemsTable,
  productCategoriesTable,
  productTokenGateTable,
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

export async function OPTIONS() {
  return publicApiCorsPreflight();
}

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
    const q = (searchParams.get("q") ?? searchParams.get("search") ?? "").trim().slice(0, 100);
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
        return withPublicApiCors(
          NextResponse.json({
            items: [],
            total: 0,
            page: 1,
            limit,
            totalPages: 0,
            categories: await getCategoriesWithProductsAndDisplayImage({ topLevelOnly: true }),
          }),
        );
      }
    }

    let whereClause =
      productIdsFilter === null
        ? and(eq(productsTable.published, true), eq(productsTable.hidden, false))
        : and(
            eq(productsTable.published, true),
            eq(productsTable.hidden, false),
            inArray(productsTable.id, productIdsFilter),
          );
    if (q.length > 0) {
      const escapedQ = q.replace(/[%_\\]/g, "\\$&");
      whereClause = and(whereClause, ilike(productsTable.name, `%${escapedQ}%`));
    }

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

    const categoriesWithImage = await getCategoriesWithProductsAndDisplayImage({ topLevelOnly: true });
    const total = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Product IDs that have token gates (from product_token_gate table). Separate query so
    // the main list never fails if the table is missing or relation has issues on deploy.
    let productIdsWithTokenGates = new Set<string>();
    const tokenGateSummaryByProductId = new Map<string, string>();
    if (rows.length > 0) {
      try {
        const ids = rows.map((r) => r.id);
        const gated = await db
          .selectDistinct({ productId: productTokenGateTable.productId })
          .from(productTokenGateTable)
          .where(inArray(productTokenGateTable.productId, ids));
        productIdsWithTokenGates = new Set(gated.map((r) => r.productId));
        if (productIdsWithTokenGates.size > 0) {
          const gateRows = await db
            .select({
              productId: productTokenGateTable.productId,
              tokenSymbol: productTokenGateTable.tokenSymbol,
              quantity: productTokenGateTable.quantity,
              network: productTokenGateTable.network,
            })
            .from(productTokenGateTable)
            .where(inArray(productTokenGateTable.productId, [...productIdsWithTokenGates]));
          const gatesByProduct = new Map<string, Array<{ tokenSymbol: string; quantity: number; network: string | null }>>();
          for (const g of gateRows) {
            const list = gatesByProduct.get(g.productId) ?? [];
            list.push({
              tokenSymbol: g.tokenSymbol,
              quantity: g.quantity,
              network: g.network,
            });
            gatesByProduct.set(g.productId, list);
          }
          for (const [productId, gates] of gatesByProduct) {
            tokenGateSummaryByProductId.set(
              productId,
              formatTokenGateSummaryToDisplay(gates),
            );
          }
        }
      } catch {
        // If product_token_gate is missing or query fails, only use column below
      }
    }

    type ProductWithRelations = (typeof rows)[number] & {
      productCategories?: Array<{ isMain?: boolean; category?: { name?: string; slug?: string } }>;
    };
    const rawItems = rows.map((p: ProductWithRelations) => {
      const mainPc =
        p.productCategories?.find((pc: { isMain?: boolean }) => pc.isMain) ??
        p.productCategories?.[0];
      const tokenGated = (p.tokenGated ?? false) || productIdsWithTokenGates.has(p.id);
      return {
        id: p.id,
        slug: p.slug ?? undefined,
        name: p.name,
        image: p.imageUrl ?? "/placeholder.svg",
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : undefined,
        category: mainPc?.category?.name ?? "Uncategorized",
        categorySlug: mainPc?.category?.slug ?? undefined,
        price: p.priceCents / 100,
        originalPrice:
          p.compareAtPriceCents != null
            ? p.compareAtPriceCents / 100
            : undefined,
        hasVariants: p.hasVariants ?? false,
        inStock: true,
        rating: 0,
        tokenGated,
        ...(tokenGated && tokenGateSummaryByProductId.has(p.id)
          ? { tokenGateSummary: tokenGateSummaryByProductId.get(p.id) }
          : {}),
      };
    });

    const cookieHeader = request.headers.get("cookie") ?? "";
    const tgCookieMatch = cookieHeader
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.toLowerCase().startsWith("tg="));
    const tgCookieValue = tgCookieMatch
      ? decodeURIComponent(tgCookieMatch.slice(tgCookieMatch.indexOf("=") + 1).trim())
      : undefined;

    const items = rawItems.map((item) => {
      const tokenGatePassed =
        item.tokenGated &&
        hasValidTokenGateCookie(tgCookieValue, "product", item.slug ?? item.id);
      return { ...item, tokenGatePassed: tokenGatePassed ?? false };
    });

    return withPublicApiCors(
      NextResponse.json(
        {
          items,
          total,
          page,
          limit,
          totalPages,
          categories: categoriesWithImage.map((c) => ({
            slug: c.slug,
            name: c.name,
            ...(c.image ? { image: c.image } : {}),
          })),
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          },
        },
      ),
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
      return withPublicApiCors(
        NextResponse.json(
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
        ),
      );
    }
    return withPublicApiCors(
      NextResponse.json(
        { error: "Failed to load products" },
        { status: 500 },
      ),
    );
  }
}

/** All categories with slug (for filter dropdown and category pages). */
