import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import {
  categoriesTable,
  productCategoriesTable,
  productsTable,
} from "~/db/schema";
import {
  publicApiCorsPreflight,
  withPublicApiCors,
} from "~/lib/cors-public-api";

interface ProductRow {
  id: string;
  imageUrl: null | string;
  name: string;
  priceCents: number;
}

const FEATURED_LIMIT = 8;
const TRENDING_LIMIT = 8;
const BEST_SELLERS_LIMIT = 8;

export async function GET() {
  try {
    const [featuredProducts, trendingProducts, bestSellersProducts] =
      await Promise.all([
        db
          .select({
            id: productsTable.id,
            imageUrl: productsTable.imageUrl,
            name: productsTable.name,
            priceCents: productsTable.priceCents,
          })
          .from(productsTable)
          .innerJoin(
            productCategoriesTable,
            eq(productsTable.id, productCategoriesTable.productId),
          )
          .innerJoin(
            categoriesTable,
            eq(productCategoriesTable.categoryId, categoriesTable.id),
          )
          .where(
            and(
              eq(productsTable.published, true),
              eq(productsTable.hidden, false),
              eq(categoriesTable.featured, true),
            ),
          )
          .orderBy(desc(productsTable.createdAt))
          .limit(FEATURED_LIMIT)
          .then((rows: ProductRow[]) =>
            rows.map((p: ProductRow) => ({
              badge: "Featured" as const,
              category: undefined as string | undefined,
              id: p.id,
              name: p.name,
              price: {
                crypto: {} as Record<string, string>,
                usd: p.priceCents / 100,
              },
            })),
          ),
        db
          .select({
            id: productsTable.id,
            imageUrl: productsTable.imageUrl,
            name: productsTable.name,
            priceCents: productsTable.priceCents,
          })
          .from(productsTable)
          .where(
            and(
              eq(productsTable.published, true),
              eq(productsTable.hidden, false),
            ),
          )
          .orderBy(desc(productsTable.createdAt))
          .limit(TRENDING_LIMIT)
          .then((rows: ProductRow[]) =>
            rows.map((p: ProductRow) => ({
              badge: "New Arrival" as const,
              category: undefined as string | undefined,
              id: p.id,
              name: p.name,
              price: {
                crypto: {} as Record<string, string>,
                usd: p.priceCents / 100,
              },
            })),
          ),
        db
          .select({
            id: productsTable.id,
            imageUrl: productsTable.imageUrl,
            name: productsTable.name,
            priceCents: productsTable.priceCents,
          })
          .from(productsTable)
          .where(
            and(
              eq(productsTable.published, true),
              eq(productsTable.hidden, false),
            ),
          )
          .orderBy(desc(productsTable.updatedAt))
          .limit(BEST_SELLERS_LIMIT)
          .then((rows: ProductRow[]) =>
            rows.map((p: ProductRow) => ({
              badge: "Popular" as const,
              category: undefined as string | undefined,
              id: p.id,
              name: p.name,
              price: {
                crypto: {} as Record<string, string>,
                usd: p.priceCents / 100,
              },
            })),
          ),
      ]);

    const featured =
      featuredProducts.length > 0
        ? featuredProducts
        : trendingProducts
            .slice(0, FEATURED_LIMIT)
            .map((p) => ({ ...p, badge: "New Arrival" as const }));

    return withPublicApiCors(
      NextResponse.json({
        bestSellers: bestSellersProducts,
        deals: [] as {
          badge: string;
          category?: string;
          id: string;
          name: string;
          price: { crypto: Record<string, string>; usd: number };
        }[],
        featured,
        trending: trendingProducts,
      }),
    );
  } catch (err) {
    console.error("Products featured error:", err);
    return withPublicApiCors(
      NextResponse.json(
        { error: "Failed to load featured products" },
        { status: 500 },
      ),
    );
  }
}

/**
 * Featured, trending, best sellers, and deals.
 * GET /api/products/featured
 * Agent discovery: see what's popular/new.
 */
export async function OPTIONS() {
  return publicApiCorsPreflight();
}
