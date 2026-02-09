import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import {
  categoriesTable,
  productCategoriesTable,
  productsTable,
} from "~/db/schema";

type ProductRow = { id: string; name: string; priceCents: number; imageUrl: string | null };

const FEATURED_LIMIT = 8;
const TRENDING_LIMIT = 8;
const BEST_SELLERS_LIMIT = 8;

/**
 * Featured, trending, best sellers, and deals.
 * GET /api/products/featured
 * Agent discovery: see what's popular/new.
 */
export async function GET() {
  try {
    const [featuredProducts, trendingProducts, bestSellersProducts] =
      await Promise.all([
        db
          .select({
            id: productsTable.id,
            name: productsTable.name,
            priceCents: productsTable.priceCents,
            imageUrl: productsTable.imageUrl,
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
              id: p.id,
              name: p.name,
              category: undefined as string | undefined,
              price: {
                usd: p.priceCents / 100,
                crypto: {} as Record<string, string>,
              },
              badge: "Featured" as const,
            })),
          ),
        db
          .select({
            id: productsTable.id,
            name: productsTable.name,
            priceCents: productsTable.priceCents,
            imageUrl: productsTable.imageUrl,
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
              id: p.id,
              name: p.name,
              category: undefined as string | undefined,
              price: {
                usd: p.priceCents / 100,
                crypto: {} as Record<string, string>,
              },
              badge: "New Arrival" as const,
            })),
          ),
        db
          .select({
            id: productsTable.id,
            name: productsTable.name,
            priceCents: productsTable.priceCents,
            imageUrl: productsTable.imageUrl,
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
              id: p.id,
              name: p.name,
              category: undefined as string | undefined,
              price: {
                usd: p.priceCents / 100,
                crypto: {} as Record<string, string>,
              },
              badge: "Popular" as const,
            })),
          ),
      ]);

    const featured =
      featuredProducts.length > 0
        ? featuredProducts
        : trendingProducts
            .slice(0, FEATURED_LIMIT)
            .map((p) => ({ ...p, badge: "New Arrival" as const }));

    return NextResponse.json({
      featured,
      trending: trendingProducts,
      bestSellers: bestSellersProducts,
      deals: [] as Array<{
        id: string;
        name: string;
        category?: string;
        price: { usd: number; crypto: Record<string, string> };
        badge: string;
      }>,
    });
  } catch (err) {
    console.error("Products featured error:", err);
    return NextResponse.json(
      { error: "Failed to load featured products" },
      { status: 500 },
    );
  }
}
