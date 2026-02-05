import { asc, eq, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import {
  categoriesTable,
  productCategoriesTable,
  productsTable,
} from "~/db/schema";

/** Cache for 5 minutes (public data) */
export const revalidate = 300;

function isMissingTableError(err: unknown): boolean {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code: string }).code
      : (err as { cause?: { code?: string } })?.cause?.code;
  return code === "42P01";
}

/**
 * List all categories with subcategories and product counts.
 * GET /api/categories
 * Agent discovery: understand store structure.
 */
export async function GET() {
  try {
    const allCategories = await db
      .select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        description: categoriesTable.description,
        slug: categoriesTable.slug,
        parentId: categoriesTable.parentId,
      })
      .from(categoriesTable)
      .orderBy(asc(categoriesTable.name));

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
      .where(eq(productsTable.published, true))
      .groupBy(productCategoriesTable.categoryId);

    const countByCategoryId = new Map(
      counts.map((c) => [c.categoryId, c.count]),
    );

    const topLevel = allCategories.filter((c) => c.parentId == null);
    const byParentId = new Map<string | null, typeof allCategories>();
    for (const c of allCategories) {
      const key = c.parentId ?? null;
      if (!byParentId.has(key)) byParentId.set(key, []);
      byParentId.get(key)!.push(c);
    }

    const categories = topLevel.map((parent) => {
      const children = (byParentId.get(parent.id) ?? []).map((child) => ({
        id: child.id,
        name: child.name,
        description: child.description ?? undefined,
        productCount: countByCategoryId.get(child.id) ?? 0,
      }));
      return {
        id: parent.id,
        name: parent.name,
        description: parent.description ?? undefined,
        slug: parent.slug ?? undefined,
        productCount: countByCategoryId.get(parent.id) ?? 0,
        subcategories: children.length > 0 ? children : undefined,
      };
    });

    return NextResponse.json(
      { categories },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    console.error("Categories list error:", err);
    if (isMissingTableError(err)) {
      return NextResponse.json(
        { categories: [] },
        {
          headers: {
            "Cache-Control":
              "public, s-maxage=60, stale-while-revalidate=120",
          },
        },
      );
    }
    return NextResponse.json(
      { error: "Failed to load categories" },
      { status: 500 },
    );
  }
}
