import { and, asc, desc, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  categoriesTable,
  productCategoriesTable,
  productsTable,
} from "~/db/schema";

const POPULAR_LIMIT = 8;

/**
 * Category details with available filters, price range, and popular products.
 * GET /api/categories/{categoryId}
 * Agent discovery: learn filters per category.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  try {
    const { categoryId } = await params;
    if (!categoryId?.trim()) {
      return NextResponse.json(
        { error: "categoryId required" },
        { status: 400 },
      );
    }

    const [category] = await db
      .select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        description: categoriesTable.description,
        slug: categoriesTable.slug,
      })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, categoryId.trim()))
      .limit(1);

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    const childCategories = await db
      .select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        description: categoriesTable.description,
      })
      .from(categoriesTable)
      .where(eq(categoriesTable.parentId, category.id))
      .orderBy(asc(categoriesTable.name));

    const productIdsInCategory = await db
      .selectDistinct({ productId: productCategoriesTable.productId })
      .from(productCategoriesTable)
      .where(eq(productCategoriesTable.categoryId, category.id));

    const ids = productIdsInCategory.map((r) => r.productId);
    if (ids.length === 0) {
      return NextResponse.json({
        id: category.id,
        name: category.name,
        description: category.description ?? undefined,
        slug: category.slug ?? undefined,
        productCount: 0,
        subcategories: childCategories.map((c) => ({ ...c, productCount: 0 })),
        availableFilters: [],
        priceRange: { min: 0, max: 0, currency: "usd" },
        popularProducts: [],
      });
    }

    const [brandCounts, priceRange, popularRows, childCounts] =
      await Promise.all([
        db
          .select({
            brand: productsTable.brand,
            count: sql<number>`count(*)::int`,
          })
          .from(productsTable)
          .innerJoin(
            productCategoriesTable,
            eq(productsTable.id, productCategoriesTable.productId),
          )
          .where(
            and(
              eq(productsTable.published, true),
              eq(productsTable.hidden, false),
              eq(productCategoriesTable.categoryId, category.id),
            ),
          )
          .groupBy(productsTable.brand),
        db
          .select({
            min: sql<number>`min(${productsTable.priceCents})::int`,
            max: sql<number>`max(${productsTable.priceCents})::int`,
          })
          .from(productsTable)
          .innerJoin(
            productCategoriesTable,
            eq(productsTable.id, productCategoriesTable.productId),
          )
          .where(
            and(
              eq(productCategoriesTable.categoryId, category.id),
              eq(productsTable.published, true),
              eq(productsTable.hidden, false),
            ),
          ),
        db
          .select({
            id: productsTable.id,
            name: productsTable.name,
            priceCents: productsTable.priceCents,
          })
          .from(productsTable)
          .innerJoin(
            productCategoriesTable,
            eq(productsTable.id, productCategoriesTable.productId),
          )
          .where(
            and(
              eq(productCategoriesTable.categoryId, category.id),
              eq(productsTable.published, true),
              eq(productsTable.hidden, false),
            ),
          )
          .orderBy(desc(productsTable.createdAt))
          .limit(POPULAR_LIMIT),
        Promise.all(
          childCategories.map(async (child) => {
            const [r] = await db
              .select({
                count: sql<number>`count(distinct ${productCategoriesTable.productId})::int`,
              })
              .from(productCategoriesTable)
              .innerJoin(
                productsTable,
                eq(productCategoriesTable.productId, productsTable.id),
              )
              .where(
                and(
                  eq(productsTable.published, true),
                  eq(productsTable.hidden, false),
                  eq(productCategoriesTable.categoryId, child.id),
                ),
              );
            return { id: child.id, productCount: r?.count ?? 0 };
          }),
        ),
      ]);

    const brandOptions = brandCounts
      .filter((r: { brand: string | null; count: number }) => r.brand != null && String(r.brand).trim() !== "")
      .map((r: { brand: string | null; count: number }) => ({
        value: String(r.brand).toLowerCase().replace(/\s+/g, "-"),
        label: String(r.brand),
        count: r.count,
      }));

    const priceMin = priceRange[0]?.min != null ? priceRange[0].min / 100 : 0;
    const priceMax = priceRange[0]?.max != null ? priceRange[0].max / 100 : 0;

    const availableFilters: Array<{
      id: string;
      name: string;
      type: string;
      options?: Array<{
        value: string | boolean;
        label: string;
        count: number;
      }>;
      min?: number;
      max?: number;
      currency?: string;
    }> = [];

    if (brandOptions.length > 0) {
      availableFilters.push({
        id: "brand",
        name: "Brand",
        type: "multiselect",
        options: brandOptions.map((o) => ({
          value: o.value,
          label: o.label,
          count: o.count,
        })),
      });
    }
    if (priceMin < priceMax) {
      availableFilters.push({
        id: "price",
        name: "Price",
        type: "range",
        min: priceMin,
        max: priceMax,
        currency: "usd",
      });
    }
    availableFilters.push({
      id: "inStock",
      name: "Availability",
      type: "boolean",
      options: [
        { value: true, label: "In Stock", count: ids.length },
        { value: false, label: "Out of Stock", count: 0 },
      ],
    });

    const childProductCountMap = new Map(
      childCounts.map((c: { id: string; productCount: number }) => [c.id, c.productCount]),
    );

    return NextResponse.json({
      id: category.id,
      name: category.name,
      description: category.description ?? undefined,
      slug: category.slug ?? undefined,
      productCount: ids.length,
      subcategories: childCategories.map((c: { id: string; name: string; description: string | null }) => ({
        id: c.id,
        name: c.name,
        description: c.description ?? undefined,
        productCount: childProductCountMap.get(c.id) ?? 0,
      })),
      availableFilters,
      priceRange: { min: priceMin, max: priceMax, currency: "usd" },
      popularProducts: popularRows.map((p: { id: string; name: string; priceCents: number }) => ({
        id: p.id,
        name: p.name,
        price: { usd: p.priceCents / 100 },
      })),
    });
  } catch (err) {
    console.error("Category detail error:", err);
    return NextResponse.json(
      { error: "Failed to load category" },
      { status: 500 },
    );
  }
}
