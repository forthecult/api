import { type NextRequest, NextResponse } from "next/server";

import {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  runProductSearch,
} from "~/lib/product-search";

type SearchBody = {
  query?: string;
  category?: string;
  subcategory?: string;
  filters?: {
    brand?: string[];
    priceRange?: { min?: number; max?: number };
    inStock?: boolean;
    rating?: string;
  };
  sort?: "price_asc" | "price_desc" | "rating" | "popular" | "newest";
  limit?: number;
  offset?: number;
};

/**
 * Search products with category context and filters.
 * POST /api/products/search
 * Agent discovery: search after learning structure from GET /api/categories and GET /api/categories/{id}.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SearchBody;
    const categoryId =
      typeof body.category === "string" ? body.category.trim() : null;
    const subcategoryId =
      typeof body.subcategory === "string" ? body.subcategory.trim() : null;
    const limit = Math.min(
      MAX_SEARCH_LIMIT,
      Math.max(1, Number(body.limit) || DEFAULT_SEARCH_LIMIT),
    );
    const offset = Math.max(0, Number(body.offset) || 0);

    if (categoryId ?? subcategoryId) {
      const targetCategoryId = subcategoryId ?? categoryId;
      if (!targetCategoryId) {
        return NextResponse.json(
          {
            error:
              "category or subcategory required when filtering by category",
          },
          { status: 400 },
        );
      }
    }

    const result = await runProductSearch({
      query: body.query,
      categoryId: categoryId ?? undefined,
      subcategoryId: subcategoryId ?? undefined,
      filters: body.filters,
      sort: body.sort ?? "newest",
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Products search error:", err);
    return NextResponse.json(
      { error: "Failed to search products" },
      { status: 500 },
    );
  }
}
