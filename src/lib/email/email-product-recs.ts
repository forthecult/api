import "server-only";

import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";

import { db } from "~/db";
import { getPublicSiteUrl } from "~/lib/app-url";
import {
  categoriesTable,
  orderItemsTable,
  ordersTable,
  productCategoriesTable,
  productsTable,
} from "~/db/schema";

export interface RecommendedProductForEmail {
  href: string;
  imageUrl: string;
  name: string;
  priceLabel: string;
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

/**
 * Picks a small set of published products related to the customer's order (shared categories),
 * excluding products already in that order. Falls back to featured storefront products.
 */
export async function fetchRecommendedProductsForEmail(options: {
  cartProductIds?: string[];
  excludeProductIds?: string[];
  limit?: number;
  orderId?: string;
  userId?: null | string;
}): Promise<RecommendedProductForEmail[]> {
  const limit = options.limit ?? 4;
  const exclude = new Set(options.excludeProductIds ?? []);

  const base = getPublicSiteUrl().replace(/\/$/, "");
  const hrefFor = (slug: string) => `${base}/products/${slug}`;

  const toRow = (p: {
    imageUrl: null | string;
    name: string;
    priceCents: number;
    slug: null | string;
  }): RecommendedProductForEmail | null => {
    if (!p.slug) return null;
    return {
      href: hrefFor(p.slug),
      imageUrl: p.imageUrl ?? "",
      name: p.name,
      priceLabel: formatPrice(p.priceCents),
    };
  };

  let categoryIds: string[] = [];
  let fromOrderProductIds: string[] = [];

  if (options.orderId) {
    const items = await db
      .select({ productId: orderItemsTable.productId })
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, options.orderId));
    fromOrderProductIds = items
      .map((i) => i.productId)
      .filter((id): id is string => Boolean(id));
    for (const id of fromOrderProductIds) exclude.add(id);

    if (fromOrderProductIds.length > 0) {
      const cats = await db
        .select({ categoryId: productCategoriesTable.categoryId })
        .from(productCategoriesTable)
        .where(inArray(productCategoriesTable.productId, fromOrderProductIds));
      categoryIds = [...new Set(cats.map((c) => c.categoryId))];
    }
  } else if (options.cartProductIds && options.cartProductIds.length > 0) {
    fromOrderProductIds = [...new Set(options.cartProductIds)].filter(Boolean);
    for (const id of fromOrderProductIds) exclude.add(id);
    const cats = await db
      .select({ categoryId: productCategoriesTable.categoryId })
      .from(productCategoriesTable)
      .where(inArray(productCategoriesTable.productId, fromOrderProductIds));
    categoryIds = [...new Set(cats.map((c) => c.categoryId))];
  } else if (options.userId) {
    const recent = await db
      .select({ id: orderItemsTable.productId })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .where(eq(ordersTable.userId, options.userId))
      .orderBy(desc(ordersTable.createdAt))
      .limit(40);
    const pids = recent
      .map((r) => r.id)
      .filter((id): id is string => Boolean(id));
    for (const id of pids) exclude.add(id);
    if (pids.length > 0) {
      const cats = await db
        .select({ categoryId: productCategoriesTable.categoryId })
        .from(productCategoriesTable)
        .where(inArray(productCategoriesTable.productId, pids));
      categoryIds = [...new Set(cats.map((c) => c.categoryId))];
    }
  }

  if (categoryIds.length > 0) {
    const related = await db
      .select({
        imageUrl: productsTable.imageUrl,
        name: productsTable.name,
        priceCents: productsTable.priceCents,
        slug: productsTable.slug,
      })
      .from(productsTable)
      .innerJoin(
        productCategoriesTable,
        eq(productCategoriesTable.productId, productsTable.id),
      )
      .where(
        and(
          inArray(productCategoriesTable.categoryId, categoryIds),
          eq(productsTable.published, true),
          eq(productsTable.hidden, false),
          eq(productsTable.isDiscontinued, false),
          exclude.size > 0
            ? notInArray(productsTable.id, [...exclude])
            : sql`true`,
        ),
      )
      .orderBy(desc(productsTable.createdAt))
      .limit(limit * 2);

    const out: RecommendedProductForEmail[] = [];
    for (const p of related) {
      const row = toRow(p);
      if (row?.imageUrl) out.push(row);
      if (out.length >= limit) break;
    }
    if (out.length >= 2) return out;
  }

  const fallback = await db
    .select({
      imageUrl: productsTable.imageUrl,
      name: productsTable.name,
      priceCents: productsTable.priceCents,
      slug: productsTable.slug,
    })
    .from(productsTable)
    .innerJoin(
      productCategoriesTable,
      eq(productCategoriesTable.productId, productsTable.id),
    )
    .innerJoin(
      categoriesTable,
      eq(categoriesTable.id, productCategoriesTable.categoryId),
    )
    .where(
      and(
        eq(productsTable.published, true),
        eq(productsTable.hidden, false),
        eq(productsTable.isDiscontinued, false),
        eq(categoriesTable.visible, true),
        exclude.size > 0
          ? notInArray(productsTable.id, [...exclude])
          : sql`true`,
      ),
    )
    .orderBy(
      desc(categoriesTable.featured),
      desc(productsTable.createdAt),
    )
    .limit(limit * 3);

  const out: RecommendedProductForEmail[] = [];
  for (const p of fallback) {
    if (exclude.has(p.slug ?? "")) continue;
    const row = toRow(p);
    if (row?.imageUrl) out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}
