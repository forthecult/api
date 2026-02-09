import { and, asc, eq, ilike, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import {
  publicApiCorsPreflight,
  withPublicApiCors,
} from "~/lib/cors-public-api";
import { db } from "~/db";
import {
  categoriesTable,
  productCategoriesTable,
  productsTable,
} from "~/db/schema";

const SUGGESTIONS_LIMIT = 10;
const CATEGORIES_LIMIT = 5;

/**
 * Search autocomplete: keywords (category names), product names, and matching categories.
 * GET /api/products/suggestions?q=headph
 * Agent discovery: autocomplete before POST /api/products/search.
 */
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length === 0) {
      return NextResponse.json({
        query: "",
        suggestions: [],
        categories: [],
      });
    }

    const pattern = `%${q}%`;

    const [categoryRows, productRows, categoryCounts] = await Promise.all([
      db
        .select({
          id: categoriesTable.id,
          name: categoriesTable.name,
        })
        .from(categoriesTable)
        .where(ilike(categoriesTable.name, pattern))
        .orderBy(asc(categoriesTable.name))
        .limit(CATEGORIES_LIMIT),
      db
        .select({
          id: productsTable.id,
          name: productsTable.name,
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
            ilike(productsTable.name, pattern),
          ),
        )
        .orderBy(asc(productsTable.name))
        .limit(SUGGESTIONS_LIMIT)
        .then((rows) =>
          rows.map((p) => ({
            id: p.id,
            name: p.name,
          })),
        ),
      db
        .select({
          categoryId: productCategoriesTable.categoryId,
          count: sql<number>`count(distinct ${productCategoriesTable.productId})::int`,
        })
        .from(productCategoriesTable)
        .innerJoin(
          productsTable,
          eq(productCategoriesTable.productId, productsTable.id),
        )
        .innerJoin(
          categoriesTable,
          eq(productCategoriesTable.categoryId, categoriesTable.id),
        )
        .where(
          and(
            eq(productsTable.published, true),
            eq(productsTable.hidden, false),
            ilike(categoriesTable.name, pattern),
          ),
        )
        .groupBy(productCategoriesTable.categoryId),
    ]);

    const countByCategoryId = new Map(
      categoryCounts.map((c) => [c.categoryId, c.count]),
    );

    const categories = categoryRows.map((c) => ({
      id: c.id,
      name: c.name,
      resultCount: countByCategoryId.get(c.id) ?? 0,
    }));

    const keywordSuggestions = categoryRows.map((c) => ({
      text: c.name,
      type: "keyword" as const,
      resultCount: countByCategoryId.get(c.id) ?? 0,
    }));

    const productSuggestions = productRows.map((p) => ({
      text: p.name,
      type: "product" as const,
      productId: p.id,
      category: undefined as string | undefined,
    }));

    const mainCategoryByProduct = await Promise.all(
      productRows.map(async (p) => {
        const [pc] = await db
          .select({ categoryId: categoriesTable.id })
          .from(productCategoriesTable)
          .innerJoin(
            categoriesTable,
            eq(productCategoriesTable.categoryId, categoriesTable.id),
          )
          .where(
            and(
              eq(productCategoriesTable.productId, p.id),
              eq(productCategoriesTable.isMain, true),
            ),
          )
          .limit(1);
        return { productId: p.id, categoryId: pc?.categoryId };
      }),
    );
    const categoryByProductId = new Map(
      mainCategoryByProduct
        .filter((x) => x.categoryId != null)
        .map((x) => [x.productId, x.categoryId]),
    );

    const suggestions = [
      ...keywordSuggestions,
      ...productSuggestions.map((s) => ({
        ...s,
        category: categoryByProductId.get(s.productId),
      })),
    ].slice(0, SUGGESTIONS_LIMIT + CATEGORIES_LIMIT);

    return withPublicApiCors(
      NextResponse.json({
        query: q,
        suggestions,
        categories,
      }),
    );
  } catch (err) {
    console.error("Products suggestions error:", err);
    return withPublicApiCors(
      NextResponse.json(
        { error: "Failed to load suggestions" },
        { status: 500 },
      ),
    );
  }
}
