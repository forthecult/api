import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import {
  categoriesTable,
  productCategoriesTable,
  productReviewsTable,
} from "~/db/schema";
import { getReviewDisplayName } from "~/lib/reviews";
import { computeCategoryIdAndDescendantIds } from "~/lib/storefront-categories";

const HOMEPAGE_LIMIT = 20;

/**
 * GET /api/reviews
 * Public. Returns visible reviews for homepage testimonials and carousels.
 * Query: limit (default 20, max 50), includeProductName (boolean),
 * forCategory (optional category slug: only reviews for products in that tree).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(
      50,
      Math.max(
        1,
        Number.parseInt(
          url.searchParams.get("limit") ?? String(HOMEPAGE_LIMIT),
          10,
        ) || HOMEPAGE_LIMIT,
      ),
    );
    const includeProductName =
      url.searchParams.get("includeProductName") === "true";
    const forCategorySlug = url.searchParams.get("forCategory")?.trim() || null;

    let productIdsInCategory: null | string[] = null;
    if (forCategorySlug) {
      const allCats = await db
        .select({
          id: categoriesTable.id,
          parentId: categoriesTable.parentId,
          slug: categoriesTable.slug,
        })
        .from(categoriesTable);
      const tree = computeCategoryIdAndDescendantIds(allCats, forCategorySlug);
      if (tree.size === 0) {
        return NextResponse.json({ items: [] });
      }
      const pRows = await db
        .selectDistinct({ productId: productCategoriesTable.productId })
        .from(productCategoriesTable)
        .where(inArray(productCategoriesTable.categoryId, [...tree]));
      const ids = [
        ...new Set(pRows.map((r) => r.productId).filter(Boolean) as string[]),
      ];
      if (ids.length === 0) {
        return NextResponse.json({ items: [] });
      }
      productIdsInCategory = ids;
    }

    const rows = await db.query.productReviewsTable.findMany({
      columns: {
        author: true,
        comment: true,
        customerName: true,
        id: true,
        rating: true,
        showName: true,
        ...(includeProductName && { productName: true }),
      },
      limit,
      orderBy: [desc(productReviewsTable.createdAt)],
      where:
        productIdsInCategory == null
          ? eq(productReviewsTable.visible, true)
          : and(
              eq(productReviewsTable.visible, true),
              isNotNull(productReviewsTable.productId),
              inArray(productReviewsTable.productId, productIdsInCategory),
            ),
    });

    const items = rows.map((r) => ({
      comment: r.comment,
      displayName: getReviewDisplayName({
        author: r.author ?? undefined,
        customerName: r.customerName,
        id: r.id,
        showName: r.showName,
      }),
      id: r.id,
      rating: r.rating,
      ...(includeProductName && {
        productName: (r as { productName?: null | string }).productName ?? null,
      }),
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Public reviews GET error:", err);
    return NextResponse.json(
      { error: "Failed to load reviews" },
      { status: 500 },
    );
  }
}
