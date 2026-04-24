import { and, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

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
import {
  computeCategoryIdAndDescendantIds,
  computeCryptoCategoryIdsIncludingDescendants,
  isCryptoStorefrontCategorySlug,
} from "~/lib/storefront-categories";

/**
 * For a crypto category page: top-level non-crypto categories that share
 * at least one published product with the given category (e.g. Apparel on Bitcoin).
 *
 * Query: forCategory = category slug (required)
 */
export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get("forCategory")?.trim();
    if (!slug) {
      return withPublicApiCors(
        NextResponse.json({ error: "forCategory required" }, { status: 400 }),
      );
    }
    const rows = await db
      .select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        parentId: categoriesTable.parentId,
        slug: categoriesTable.slug,
      })
      .from(categoriesTable);
    if (!isCryptoStorefrontCategorySlug(rows, slug)) {
      return withPublicApiCors(NextResponse.json({ items: [] }));
    }
    const cryptoCategoryIds = computeCategoryIdAndDescendantIds(rows, slug);
    if (cryptoCategoryIds.size === 0) {
      return withPublicApiCors(NextResponse.json({ items: [] }));
    }
    const productRows = await db
      .selectDistinct({ productId: productCategoriesTable.productId })
      .from(productCategoriesTable)
      .where(
        inArray(productCategoriesTable.categoryId, [...cryptoCategoryIds]),
      );
    const cryptoProductIds = new Set(
      productRows.map((r) => r.productId).filter(Boolean) as string[],
    );
    if (cryptoProductIds.size === 0) {
      return withPublicApiCors(NextResponse.json({ items: [] }));
    }
    const cryptoRowIds = computeCryptoCategoryIdsIncludingDescendants(
      rows.map((r) => ({ id: r.id, name: r.name, parentId: r.parentId })),
    );
    const topLevel = rows.filter(
      (r) => r.parentId == null && r.slug != null && !cryptoRowIds.has(r.id),
    );
    const out: { name: string; slug: string }[] = [];
    for (const t of topLevel) {
      const tSlug = t.slug;
      if (!tSlug) continue;
      const merchTree = computeCategoryIdAndDescendantIds(rows, tSlug);
      if (merchTree.size === 0) continue;
      const [row] = await db
        .select({ p: productCategoriesTable.productId })
        .from(productCategoriesTable)
        .innerJoin(
          productsTable,
          eq(productCategoriesTable.productId, productsTable.id),
        )
        .where(
          and(
            inArray(productCategoriesTable.productId, [...cryptoProductIds]),
            inArray(productCategoriesTable.categoryId, [...merchTree]),
            eq(productsTable.published, true),
            eq(productsTable.hidden, false),
          ),
        )
        .limit(1);
      if (row?.p) out.push({ name: t.name, slug: tSlug });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return withPublicApiCors(NextResponse.json({ items: out }));
  } catch (err) {
    console.error("merch-filters error:", err);
    return withPublicApiCors(
      NextResponse.json({ error: "Failed to load filters" }, { status: 500 }),
    );
  }
}

export function OPTIONS() {
  return publicApiCorsPreflight();
}
