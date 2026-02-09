/**
 * Shared product search logic for POST /api/products/search and POST /api/products/semantic-search.
 */

import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { db } from "~/db";
import {
  categoriesTable,
  productCategoriesTable,
  productsTable,
} from "~/db/schema";

export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 100;

export type ProductSearchParams = {
  query?: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  filters?: {
    brand?: string[];
    priceRange?: { min?: number; max?: number };
    inStock?: boolean;
    rating?: string;
  };
  sort?: "price_asc" | "price_desc" | "rating" | "popular" | "newest";
  limit?: number;
  offset?: number;
};

export type ProductSearchResultItem = {
  id: string;
  name: string;
  description?: string;
  price: { usd: number; crypto: Record<string, string> };
  imageUrl?: string;
  category?: string;
  inStock: boolean;
  slug?: string;
};

export type ProductSearchResult = {
  products: ProductSearchResultItem[];
  total: number;
  limit: number;
  offset: number;
};

export async function runProductSearch(
  params: ProductSearchParams,
): Promise<ProductSearchResult> {
  const query = typeof params.query === "string" ? params.query.trim() : "";
  const categoryId = params.categoryId ?? null;
  const subcategoryId = params.subcategoryId ?? null;
  const filters = params.filters ?? {};
  const sort = params.sort ?? "newest";
  const limit = Math.min(
    MAX_SEARCH_LIMIT,
    Math.max(1, Number(params.limit) || DEFAULT_SEARCH_LIMIT),
  );
  const offset = Math.max(0, Number(params.offset) || 0);

  const conditions = [
    eq(productsTable.published, true),
    eq(productsTable.hidden, false),
  ];

  if (query.length > 0) {
    const pattern = `%${query}%`;
    conditions.push(
      or(
        ilike(productsTable.name, pattern),
        ilike(productsTable.description, pattern),
      )!,
    );
  }

  if (categoryId || subcategoryId) {
    const targetCategoryId = subcategoryId ?? categoryId;
    if (targetCategoryId) {
      const productIdsInCategory = await db
        .selectDistinct({ productId: productCategoriesTable.productId })
        .from(productCategoriesTable)
        .where(eq(productCategoriesTable.categoryId, targetCategoryId));
      const ids = productIdsInCategory.map((r) => r.productId);
      if (ids.length === 0) {
        return { products: [], total: 0, limit, offset };
      }
      conditions.push(inArray(productsTable.id, ids));
    }
  }

  if (filters.brand?.length) {
    const brandSlugs = filters.brand.map((b) => String(b).toLowerCase().trim());
    const allBrands = await db
      .selectDistinct({ brand: productsTable.brand })
      .from(productsTable)
      .where(
        and(
          eq(productsTable.published, true),
          eq(productsTable.hidden, false),
          sql`${productsTable.brand} is not null`,
        ),
      );
    const matchingBrands = allBrands.filter(
      (r: { brand: string | null }) =>
        r.brand != null &&
        brandSlugs.includes(
          String(r.brand)
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, ""),
        ),
    );
    const brandNames = matchingBrands.map((r: { brand: string | null }) => r.brand!);
    if (brandNames.length > 0) {
      conditions.push(inArray(productsTable.brand, brandNames));
    }
  }

  if (filters.priceRange) {
    const minCents =
      filters.priceRange.min != null
        ? Math.round(filters.priceRange.min * 100)
        : undefined;
    const maxCents =
      filters.priceRange.max != null
        ? Math.round(filters.priceRange.max * 100)
        : undefined;
    if (minCents != null)
      conditions.push(gte(productsTable.priceCents, minCents));
    if (maxCents != null)
      conditions.push(lte(productsTable.priceCents, maxCents));
  }

  const whereClause = and(...conditions);

  const orderBy =
    sort === "price_asc"
      ? asc(productsTable.priceCents)
      : sort === "price_desc"
        ? desc(productsTable.priceCents)
        : sort === "popular"
          ? desc(productsTable.updatedAt)
          : desc(productsTable.createdAt);

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        description: productsTable.description,
        priceCents: productsTable.priceCents,
        imageUrl: productsTable.imageUrl,
        slug: productsTable.slug,
      })
      .from(productsTable)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(productsTable)
      .where(whereClause),
  ]);

  const total = countResult[0]?.count ?? 0;

  const productIds = rows.map((p) => p.id);
  const mainCategories =
    productIds.length > 0
      ? await db
          .select({
            productId: productCategoriesTable.productId,
            categoryId: categoriesTable.id,
          })
          .from(productCategoriesTable)
          .innerJoin(
            categoriesTable,
            eq(productCategoriesTable.categoryId, categoriesTable.id),
          )
          .where(
            and(
              inArray(productCategoriesTable.productId, productIds),
              eq(productCategoriesTable.isMain, true),
            ),
          )
      : [];
  const categoryByProductId = new Map(
    mainCategories.map((c) => [c.productId, c.categoryId]),
  );

  const products: ProductSearchResultItem[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? undefined,
    price: {
      usd: p.priceCents / 100,
      crypto: {} as Record<string, string>,
    },
    imageUrl: p.imageUrl ?? undefined,
    category: categoryByProductId.get(p.id),
    inStock: true,
    slug: p.slug ?? undefined,
  }));

  return { products, total, limit, offset };
}
