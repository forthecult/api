import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "~/db";
import {
  categoriesTable,
  productCategoriesTable,
  productReviewsTable,
  productsTable,
  productTokenGateTable,
} from "~/db/schema";
import { getReviewDisplayName } from "~/lib/reviews";
import { SHOW_IN_ALL_PRODUCTS_CATEGORY_SLUG } from "~/lib/storefront-categories";
import { hasValidTokenGateCookie } from "~/lib/token-gate-cookie";

/**
 * server-side data loaders for the home page. these replace what used to be
 * `fetch("/api/categories")` / `fetch("/api/products?…featured…")` /
 * `fetch("/api/reviews")` calls — same-origin http hops from an RSC into its
 * own route handler, which forced `force-dynamic` on the route, added latency,
 * and killed any serialization caching. talking to the db directly from the
 * RSC lets next apply its normal caching rules and skips a round trip.
 */

export interface HomeCategoryListItem {
  id: string;
  name: string;
  productCount: number;
  slug: string;
}

export interface HomeFeaturedProduct {
  category: string;
  hasVariants: boolean;
  id: string;
  image: string;
  inStock: boolean;
  name: string;
  originalPrice?: number;
  price: number;
  rating: number;
  slug?: string;
  tokenGated: boolean;
  tokenGatePassed: boolean;
}

export interface HomeTestimonial {
  author: { avatar?: string; handle?: string; name: string };
  productTitle?: string;
  rating?: number;
  text: string;
}

/**
 * Featured products for the home grid. simplified version of /api/products
 * for the specific shape the home needs (category=__featured__, sort=manual,
 * limit=8). applies product-level token-gate cookie check only — cross-category
 * cascade is not needed for the home preview, and requires expensive per-product
 * lookups we'd rather not do on a public landing page.
 */
export async function getHomeFeaturedProducts(
  tgCookieValue: string | undefined,
  limit = 8,
): Promise<HomeFeaturedProduct[]> {
  const featuredProductRows = await db
    .select({ productId: productCategoriesTable.productId })
    .from(productCategoriesTable)
    .innerJoin(
      categoriesTable,
      eq(productCategoriesTable.categoryId, categoriesTable.id),
    )
    .where(eq(categoriesTable.featured, true));
  const productIdsFilter = [
    ...new Set(featuredProductRows.map((r) => r.productId)),
  ];

  if (productIdsFilter.length === 0) return [];

  let manualSortMap: Map<string, number> | null = null;
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
      .where(eq(categoriesTable.featured, true));
    manualSortMap = new Map();
    for (const r of sortRows) {
      if (!manualSortMap.has(r.productId)) {
        manualSortMap.set(r.productId, r.sortOrder ?? 999_999);
      }
    }
  } catch {
    // sortOrder column may not exist yet — fall back to createdAt desc
    manualSortMap = null;
  }

  const whereClause = and(
    eq(productsTable.published, true),
    eq(productsTable.hidden, false),
    inArray(productsTable.id, productIdsFilter),
  );

  let rows: Awaited<ReturnType<typeof db.query.productsTable.findMany>>;
  if (manualSortMap) {
    const allIds = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(whereClause);
    const sortedIds = allIds
      .map((r) => r.id)
      .sort((a, b) => {
        const ao = manualSortMap!.get(a) ?? 999_999;
        const bo = manualSortMap!.get(b) ?? 999_999;
        return ao - bo;
      })
      .slice(0, limit);
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
  } else {
    rows = await db.query.productsTable.findMany({
      limit,
      orderBy: [desc(productsTable.createdAt)],
      where: whereClause,
      with: {
        productCategories: { with: { category: true } },
        productVariants: { columns: { stockQuantity: true } },
      },
    });
  }

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  let productIdsWithTokenGates = new Set<string>();
  try {
    const gated = await db
      .selectDistinct({ productId: productTokenGateTable.productId })
      .from(productTokenGateTable)
      .where(inArray(productTokenGateTable.productId, ids));
    productIdsWithTokenGates = new Set(gated.map((r) => r.productId));
  } catch {
    // product_token_gate table may be missing on fresh deploys
  }

  type Row = (typeof rows)[number] & {
    productCategories?: {
      category?: { name?: string; slug?: string };
      isMain?: boolean;
    }[];
    productVariants?: { stockQuantity?: null | number }[];
  };

  return rows.map((p: Row): HomeFeaturedProduct => {
    const mainPc =
      p.productCategories?.find((pc) => pc.isMain) ?? p.productCategories?.[0];
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
    const tokenGatePassed =
      tokenGated &&
      hasValidTokenGateCookie(tgCookieValue, "product", p.slug ?? p.id);
    return {
      category: mainPc?.category?.name ?? "Uncategorized",
      hasVariants: p.hasVariants ?? false,
      id: p.id,
      image: p.imageUrl ?? "/placeholder.svg",
      inStock,
      name: p.name,
      originalPrice:
        p.compareAtPriceCents != null ? p.compareAtPriceCents / 100 : undefined,
      price: p.priceCents / 100,
      rating: 0,
      slug: p.slug ?? undefined,
      tokenGated,
      tokenGatePassed,
    };
  });
}

/** categories that have at least one published product, with counts. */
export async function getHomePublicCategories(): Promise<
  HomeCategoryListItem[]
> {
  // mirror /api/categories semantics: visible=true when column exists,
  // exclude the internal "show in all products" slug. we stay tolerant of
  // a missing `visible` column so this keeps working through a db:push window.
  let allCategories: {
    id: string;
    name: string;
    parentId: null | string;
    slug: null | string;
    visible: boolean;
  }[];
  try {
    allCategories = await db
      .select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        parentId: categoriesTable.parentId,
        slug: categoriesTable.slug,
        visible: categoriesTable.visible,
      })
      .from(categoriesTable)
      .orderBy(asc(categoriesTable.name));
  } catch {
    const rows = await db
      .select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        parentId: categoriesTable.parentId,
        slug: categoriesTable.slug,
      })
      .from(categoriesTable)
      .orderBy(asc(categoriesTable.name));
    allCategories = rows.map((r) => ({ ...r, visible: true }));
  }

  allCategories = allCategories
    .filter((c) => c.visible !== false)
    .filter(
      (c) => c.slug?.toLowerCase() !== SHOW_IN_ALL_PRODUCTS_CATEGORY_SLUG,
    );

  const counts = await db
    .select({
      categoryId: productCategoriesTable.categoryId,
      count: sql<number>`count(distinct ${productCategoriesTable.productId})::int`,
    })
    .from(productCategoriesTable)
    .innerJoin(
      productsTable,
      eq(productCategoriesTable.productId, productsTable.id),
    )
    .where(
      and(eq(productsTable.published, true), eq(productsTable.hidden, false)),
    )
    .groupBy(productCategoriesTable.categoryId);
  const countByCategoryId = new Map(counts.map((c) => [c.categoryId, c.count]));

  return allCategories
    .filter(
      (c): c is typeof c & { slug: string } =>
        typeof c.slug === "string" && c.slug.length > 0,
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      productCount: countByCategoryId.get(c.id) ?? 0,
      slug: c.slug,
    }));
}

/** Visible reviews for the home testimonials marquee. */
export async function getHomeTestimonials(
  limit = 20,
): Promise<HomeTestimonial[]> {
  const rows = await db.query.productReviewsTable.findMany({
    columns: {
      author: true,
      comment: true,
      customerName: true,
      id: true,
      productName: true,
      rating: true,
      showName: true,
    },
    limit,
    orderBy: [desc(productReviewsTable.createdAt)],
    where: eq(productReviewsTable.visible, true),
  });
  return rows.map((r) => ({
    author: {
      name: getReviewDisplayName({
        author: r.author ?? undefined,
        customerName: r.customerName,
        id: r.id,
        showName: r.showName,
      }),
    },
    productTitle: r.productName ?? undefined,
    rating: r.rating,
    text: r.comment,
  }));
}
