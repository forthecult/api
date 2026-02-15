import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import {
  categoriesTable,
  productCategoriesTable,
  productsTable,
} from "~/db/schema";

/** Cache for 5 minutes (public data) */
export const revalidate = 300;

/**
 * List all categories with subcategories and product counts.
 * GET /api/categories
 * Agent discovery: understand store structure.
 */
export async function GET() {
  try {
    // Fetch all categories; try to include the `visible` column. If it doesn't
    // exist yet (needs db:push), fall back to treating all as visible.
    let allCategories: {
      description: null | string;
      id: string;
      name: string;
      parentId: null | string;
      slug: null | string;
      visible: boolean;
    }[];
    try {
      allCategories = await db
        .select({
          description: categoriesTable.description,
          id: categoriesTable.id,
          name: categoriesTable.name,
          parentId: categoriesTable.parentId,
          slug: categoriesTable.slug,
          visible: categoriesTable.visible,
        })
        .from(categoriesTable)
        .orderBy(asc(categoriesTable.name));
    } catch {
      // visible column may not exist yet — fetch without it
      const rows = await db
        .select({
          description: categoriesTable.description,
          id: categoriesTable.id,
          name: categoriesTable.name,
          parentId: categoriesTable.parentId,
          slug: categoriesTable.slug,
        })
        .from(categoriesTable)
        .orderBy(asc(categoriesTable.name));
      allCategories = rows.map((r) => ({ ...r, visible: true }));
    }

    // Filter out categories marked as not visible
    allCategories = allCategories.filter((c) => c.visible !== false);

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

    const countByCategoryId = new Map(
      counts.map((c) => [c.categoryId, c.count]),
    );

    const topLevel = allCategories.filter((c) => c.parentId == null);
    const byParentId = new Map<null | string, typeof allCategories>();
    for (const c of allCategories) {
      const key = c.parentId ?? null;
      if (!byParentId.has(key)) byParentId.set(key, []);
      byParentId.get(key)!.push(c);
    }

    const categories = topLevel.map((parent) => {
      const children = (byParentId.get(parent.id) ?? []).map((child) => ({
        description: child.description ?? undefined,
        id: child.id,
        name: child.name,
        productCount: countByCategoryId.get(child.id) ?? 0,
        slug: child.slug ?? undefined,
      }));
      return {
        description: parent.description ?? undefined,
        id: parent.id,
        name: parent.name,
        productCount: countByCategoryId.get(parent.id) ?? 0,
        slug: parent.slug ?? undefined,
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
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
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

function isMissingTableError(err: unknown): boolean {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code: string }).code
      : (err as { cause?: { code?: string } })?.cause?.code;
  return code === "42P01";
}
