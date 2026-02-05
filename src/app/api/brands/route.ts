import { and, eq, isNotNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import {
  brandTable,
  productCategoriesTable,
  productsTable,
} from "~/db/schema";

/** Cache for 5 minutes (public data) */
export const revalidate = 300;

/**
 * List all brands: curated brands from brand table + product-derived brands.
 * GET /api/brands
 * Agent discovery: optional, for filter/autocomplete context.
 */
export async function GET() {
  try {
    const [curatedBrands, brandCounts, brandCategories] = await Promise.all([
      db.select({
        id: brandTable.id,
        name: brandTable.name,
        slug: brandTable.slug,
        logoUrl: brandTable.logoUrl,
        websiteUrl: brandTable.websiteUrl,
        description: brandTable.description,
        featured: brandTable.featured,
      }).from(brandTable),
      db
        .select({
          brand: productsTable.brand,
          count: sql<number>`count(*)::int`,
        })
        .from(productsTable)
        .where(
          and(
            eq(productsTable.published, true),
            isNotNull(productsTable.brand),
          ),
        )
        .groupBy(productsTable.brand),
      db
        .selectDistinct({
          brand: productsTable.brand,
          categoryId: productCategoriesTable.categoryId,
        })
        .from(productCategoriesTable)
        .innerJoin(
          productsTable,
          eq(productCategoriesTable.productId, productsTable.id),
        )
        .where(
          and(
            eq(productsTable.published, true),
            isNotNull(productsTable.brand),
          ),
        ),
    ]);

    const categoryByBrand = new Map<string, Set<string>>();
    for (const row of brandCategories) {
      if (row.brand == null) continue;
      const brandName = String(row.brand).trim();
      if (!categoryByBrand.has(brandName)) {
        categoryByBrand.set(brandName, new Set());
      }
      categoryByBrand.get(brandName)!.add(row.categoryId);
    }

    const countByBrand = new Map(
      brandCounts
        .filter((r) => r.brand != null && String(r.brand).trim() !== "")
        .map((r) => [String(r.brand).trim(), r.count]),
    );

    const byName = new Map(
      curatedBrands.map((b) => [b.name.trim().toLowerCase(), b]),
    );

    const productOnlyNames = new Set(
      countByBrand.keys(),
    );
    for (const b of curatedBrands) {
      productOnlyNames.delete(b.name.trim());
    }

    const brands: Array<{
      id: string;
      name: string;
      logo: string | null;
      websiteUrl?: string | null;
      description?: string | null;
      featured?: boolean;
      productCount: number;
      categories: string[];
    }> = [];

    for (const c of curatedBrands) {
      const name = c.name.trim();
      const productCount = countByBrand.get(name) ?? 0;
      const catIds = Array.from(categoryByBrand.get(name) ?? []);
      brands.push({
        id: c.slug || c.id,
        name,
        logo: c.logoUrl ?? null,
        websiteUrl: c.websiteUrl ?? null,
        description: c.description ?? null,
        featured: c.featured ?? false,
        productCount,
        categories: catIds,
      });
    }

    for (const brandName of productOnlyNames) {
      const slug = brandName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      const catIds = Array.from(categoryByBrand.get(brandName) ?? []);
      brands.push({
        id: slug || brandName,
        name: brandName,
        logo: null,
        productCount: countByBrand.get(brandName) ?? 0,
        categories: catIds,
      });
    }

    brands.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );

    return NextResponse.json(
      { brands },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    console.error("Brands list error:", err);
    return NextResponse.json(
      { error: "Failed to load brands" },
      { status: 500 },
    );
  }
}
