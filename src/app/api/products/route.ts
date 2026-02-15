import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  notInArray,
  sql,
} from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import {
  publicApiCorsPreflight,
  withPublicApiCors,
} from "~/lib/cors-public-api";
import { db } from "~/db";
import { getCategoriesWithProductsAndDisplayImage } from "~/lib/categories";
import {
  computeCategoryIdAndDescendantIds,
  computeCryptoCategoryIdsIncludingDescendants,
  SHOW_IN_ALL_PRODUCTS_CATEGORY_SLUG,
} from "~/lib/storefront-categories";
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
  | "rating"
  | "manual";

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
    const forStorefront =
      searchParams.get("forStorefront") === "1" ||
      searchParams.get("forStorefront") === "true";
    const q = (searchParams.get("q") ?? searchParams.get("search") ?? "")
      .trim()
      .slice(0, 100);
    const sortParam = (searchParams.get("sort")?.trim() ||
      "newest") as ProductsSort;
    const sort: ProductsSort = [
      "newest",
      "price_asc",
      "price_desc",
      "best_selling",
      "rating",
      "manual",
    ].includes(sortParam)
      ? sortParam
      : "newest";
    const offset = (page - 1) * limit;

    const categorySlugToFilter = subcategory || category;

    // For manual sort we need the sortOrder from the junction table, keyed by productId.
    // Fetched separately and wrapped in try-catch so the feature degrades gracefully
    // if the sort_order column hasn't been added yet (requires db:push).
    let manualSortMap: Map<string, number> | null = null;

    let productIdsFilter: string[] | null = null;

    // Special token: "__featured__" means "products in any category with featured = true"
    if (categorySlugToFilter === "__featured__") {
      const rows = await db
        .select({ productId: productCategoriesTable.productId })
        .from(productCategoriesTable)
        .innerJoin(
          categoriesTable,
          eq(productCategoriesTable.categoryId, categoriesTable.id),
        )
        .where(eq(categoriesTable.featured, true));
      productIdsFilter = [...new Set(rows.map((r) => r.productId))];
      if (productIdsFilter.length === 0) {
        // Fallback: return newest products when no featured categories exist
        productIdsFilter = null;
      }
    } else if (categorySlugToFilter) {
      // Include products in this category and all its subcategories
      const categoryRows = await db
        .select({
          id: categoriesTable.id,
          slug: categoriesTable.slug,
          parentId: categoriesTable.parentId,
        })
        .from(categoriesTable);
      const categoryIdsIncludingDescendants = computeCategoryIdAndDescendantIds(
        categoryRows,
        categorySlugToFilter,
      );
      if (categoryIdsIncludingDescendants.size === 0) {
        return withPublicApiCors(
          NextResponse.json({
            items: [],
            total: 0,
            page: 1,
            limit,
            totalPages: 0,
            categories: await getCategoriesWithProductsAndDisplayImage({
              topLevelOnly: true,
            }),
          }),
        );
      }
      const rows = await db
        .select({ productId: productCategoriesTable.productId })
        .from(productCategoriesTable)
        .where(
          inArray(productCategoriesTable.categoryId, [
            ...categoryIdsIncludingDescendants,
          ]),
        );
      productIdsFilter = [...new Set(rows.map((r) => r.productId))];
      if (productIdsFilter.length === 0) {
        return withPublicApiCors(
          NextResponse.json({
            items: [],
            total: 0,
            page: 1,
            limit,
            totalPages: 0,
            categories: await getCategoriesWithProductsAndDisplayImage({
              topLevelOnly: true,
            }),
          }),
        );
      }
    } else {
      // "All" products. When forStorefront: exclude any product in a crypto (or sub) category
      // unless it is also in show-in-all-products. When not forStorefront (e.g. AI agents): no filter.
      // When a search query is active, skip the crypto exclusion so users can find crypto products via search.
      if (forStorefront && q.length === 0) {
        const categoryRows = await db
          .select({
            id: categoriesTable.id,
            name: categoriesTable.name,
            parentId: categoriesTable.parentId,
          })
          .from(categoriesTable);
        const cryptoCategoryIds =
          computeCryptoCategoryIdsIncludingDescendants(categoryRows);
        const productIdsInCrypto =
          cryptoCategoryIds.size > 0
            ? await db
                .selectDistinct({ productId: productCategoriesTable.productId })
                .from(productCategoriesTable)
                .where(
                  inArray(productCategoriesTable.categoryId, [
                    ...cryptoCategoryIds,
                  ]),
                )
            : [];
        const productIdsInShowInAll = await db
          .selectDistinct({ productId: productCategoriesTable.productId })
          .from(productCategoriesTable)
          .innerJoin(
            categoriesTable,
            eq(productCategoriesTable.categoryId, categoriesTable.id),
          )
          .where(eq(categoriesTable.slug, SHOW_IN_ALL_PRODUCTS_CATEGORY_SLUG));
        const showInAllSet = new Set(
          productIdsInShowInAll.map((r) => r.productId),
        );
        const excludeFromAll = new Set(
          productIdsInCrypto
            .map((r) => r.productId)
            .filter((id) => !showInAllSet.has(id)),
        );
        const allPublished = await db
          .select({ id: productsTable.id })
          .from(productsTable)
          .where(
            and(
              eq(productsTable.published, true),
              eq(productsTable.hidden, false),
            ),
          );
        productIdsFilter = allPublished
          .filter((r) => !excludeFromAll.has(r.id))
          .map((r) => r.id);
        if (productIdsFilter.length === 0) {
          productIdsFilter = null;
        }
      }
    }

    // If manual sort was requested and we have a category filter, try to load sort_order.
    // Wrapped in try-catch: the sort_order column may not exist yet (needs db:push).
    if (sort === "manual" && productIdsFilter && productIdsFilter.length > 0) {
      try {
        const sortRows = await db
          .select({
            productId: productCategoriesTable.productId,
            sortOrder: productCategoriesTable.sortOrder,
          })
          .from(productCategoriesTable)
          .innerJoin(
            categoriesTable,
            eq(productCategoriesTable.categoryId, categoriesTable.id),
          )
          .where(
            categorySlugToFilter === "__featured__"
              ? eq(categoriesTable.featured, true)
              : eq(categoriesTable.slug, categorySlugToFilter!),
          );
        manualSortMap = new Map<string, number>();
        for (const r of sortRows) {
          if (!manualSortMap.has(r.productId)) {
            manualSortMap.set(r.productId, r.sortOrder ?? 999999);
          }
        }
      } catch {
        // sort_order column doesn't exist yet — fall back to newest ordering
        manualSortMap = null;
      }
    }

    let whereClause =
      productIdsFilter === null
        ? and(
            eq(productsTable.published, true),
            eq(productsTable.hidden, false),
          )
        : and(
            eq(productsTable.published, true),
            eq(productsTable.hidden, false),
            inArray(productsTable.id, productIdsFilter),
          );
    if (q.length > 0) {
      const escapedQ = q.replace(/[%_\\]/g, "\\$&");
      whereClause = and(
        whereClause,
        ilike(productsTable.name, `%${escapedQ}%`),
      );
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

    let rows: Awaited<ReturnType<typeof db.query.productsTable.findMany>>;
    if (sort === "manual" && manualSortMap) {
      // Manual sort: use the sortOrder from the product_category junction table.
      // Fetch all matching IDs, sort in JS, then paginate.
      const allIds = await db
        .select({ id: productsTable.id })
        .from(productsTable)
        .where(whereClause);
      const sortedIds = allIds
        .map((r) => r.id)
        .sort((a, b) => {
          const aO = manualSortMap!.get(a) ?? 999999;
          const bO = manualSortMap!.get(b) ?? 999999;
          return aO - bO;
        })
        .slice(offset, offset + limit);
      if (sortedIds.length === 0) {
        rows = [];
      } else {
        const found = await db.query.productsTable.findMany({
          where: inArray(productsTable.id, sortedIds),
          with: {
            productCategories: { with: { category: true } },
            productVariants: { columns: { stockQuantity: true } },
          },
        });
        const orderMap = new Map(sortedIds.map((id, i) => [id, i]));
        rows = found.sort(
          (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
        );
      }
    } else if (sort === "best_selling") {
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
            productVariants: { columns: { stockQuantity: true } },
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
          productVariants: { columns: { stockQuantity: true } },
        },
      } as Parameters<typeof db.query.productsTable.findMany>[0]);
    }

    const categoriesWithImage = await getCategoriesWithProductsAndDisplayImage({
      topLevelOnly: true,
    });
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
            .where(
              inArray(productTokenGateTable.productId, [
                ...productIdsWithTokenGates,
              ]),
            );
          const gatesByProduct = new Map<
            string,
            Array<{
              tokenSymbol: string;
              quantity: number;
              network: string | null;
            }>
          >();
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
      productCategories?: Array<{
        isMain?: boolean;
        category?: { name?: string; slug?: string };
      }>;
      productVariants?: Array<{ stockQuantity?: number | null }>;
    };
    const rawItems = rows.map((p: ProductWithRelations) => {
      const mainPc =
        p.productCategories?.find((pc: { isMain?: boolean }) => pc.isMain) ??
        p.productCategories?.[0];
      const tokenGated =
        (p.tokenGated ?? false) || productIdsWithTokenGates.has(p.id);
      const inStock = (() => {
        if (p.continueSellingWhenOutOfStock) return true;
        if (p.hasVariants) {
          const variants = p.productVariants ?? [];
          return variants.some((v) => (v.stockQuantity ?? 0) > 0);
        }
        if (!p.trackQuantity) return true;
        return (p.quantity ?? 0) > 0;
      })();
      return {
        id: p.id,
        slug: p.slug ?? undefined,
        name: p.name,
        image: p.imageUrl ?? "/placeholder.svg",
        createdAt: p.createdAt
          ? new Date(p.createdAt).toISOString()
          : undefined,
        category: mainPc?.category?.name ?? "Uncategorized",
        categorySlug: mainPc?.category?.slug ?? undefined,
        price: p.priceCents / 100,
        originalPrice:
          p.compareAtPriceCents != null
            ? p.compareAtPriceCents / 100
            : undefined,
        hasVariants: p.hasVariants ?? false,
        inStock,
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
      ? decodeURIComponent(
          tgCookieMatch.slice(tgCookieMatch.indexOf("=") + 1).trim(),
        )
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
      NextResponse.json({ error: "Failed to load products" }, { status: 500 }),
    );
  }
}

/** All categories with slug (for filter dropdown and category pages). */
