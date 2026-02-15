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
        description: categoriesTable.description,
        id: categoriesTable.id,
        name: categoriesTable.name,
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
        description: categoriesTable.description,
        id: categoriesTable.id,
        name: categoriesTable.name,
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
        availableFilters: [],
        description: category.description ?? undefined,
        id: category.id,
        name: category.name,
        popularProducts: [],
        priceRange: { currency: "usd", max: 0, min: 0 },
        productCount: 0,
        slug: category.slug ?? undefined,
        subcategories: childCategories.map((c) => ({ ...c, productCount: 0 })),
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
            max: sql<number>`max(${productsTable.priceCents})::int`,
            min: sql<number>`min(${productsTable.priceCents})::int`,
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
      .filter(
        (r: { brand: null | string; count: number }) =>
          r.brand != null && String(r.brand).trim() !== "",
      )
      .map((r: { brand: null | string; count: number }) => ({
        count: r.count,
        label: String(r.brand),
        value: String(r.brand).toLowerCase().replace(/\s+/g, "-"),
      }));

    const priceMin = priceRange[0]?.min != null ? priceRange[0].min / 100 : 0;
    const priceMax = priceRange[0]?.max != null ? priceRange[0].max / 100 : 0;

    const availableFilters: {
      currency?: string;
      id: string;
      max?: number;
      min?: number;
      name: string;
      options?: {
        count: number;
        label: string;
        value: boolean | string;
      }[];
      type: string;
    }[] = [];

    if (brandOptions.length > 0) {
      availableFilters.push({
        id: "brand",
        name: "Brand",
        options: brandOptions.map((o) => ({
          count: o.count,
          label: o.label,
          value: o.value,
        })),
        type: "multiselect",
      });
    }
    if (priceMin < priceMax) {
      availableFilters.push({
        currency: "usd",
        id: "price",
        max: priceMax,
        min: priceMin,
        name: "Price",
        type: "range",
      });
    }
    availableFilters.push({
      id: "inStock",
      name: "Availability",
      options: [
        { count: ids.length, label: "In Stock", value: true },
        { count: 0, label: "Out of Stock", value: false },
      ],
      type: "boolean",
    });

    const childProductCountMap = new Map(
      childCounts.map((c: { id: string; productCount: number }) => [
        c.id,
        c.productCount,
      ]),
    );

    return NextResponse.json({
      availableFilters,
      description: category.description ?? undefined,
      id: category.id,
      name: category.name,
      popularProducts: popularRows.map(
        (p: { id: string; name: string; priceCents: number }) => ({
          id: p.id,
          name: p.name,
          price: { usd: p.priceCents / 100 },
        }),
      ),
      priceRange: { currency: "usd", max: priceMax, min: priceMin },
      productCount: ids.length,
      slug: category.slug ?? undefined,
      subcategories: childCategories.map(
        (c: { description: null | string; id: string; name: string }) => ({
          description: c.description ?? undefined,
          id: c.id,
          name: c.name,
          productCount: childProductCountMap.get(c.id) ?? 0,
        }),
      ),
    });
  } catch (err) {
    console.error("Category detail error:", err);
    return NextResponse.json(
      { error: "Failed to load category" },
      { status: 500 },
    );
  }
}
