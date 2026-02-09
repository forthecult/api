import { type NextRequest, NextResponse } from "next/server";

import {
  publicApiCorsPreflight,
  withPublicApiCors,
} from "~/lib/cors-public-api";
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

export async function OPTIONS() {
  return publicApiCorsPreflight();
}

/**
 * Search products via GET (query params). Matches docs and AI clients that call GET /api/products/search?q=...
 * CORS: Allow-Origin * (see cors-public-api). If clients see "Failed to fetch", try GET /api/health first to confirm reachability.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q")?.trim() ?? undefined;
    const category = searchParams.get("category")?.trim() ?? undefined;
    const subcategory = searchParams.get("subcategory")?.trim() ?? undefined;
    const limit = Math.min(
      MAX_SEARCH_LIMIT,
      Math.max(1, Number(searchParams.get("limit")) || DEFAULT_SEARCH_LIMIT),
    );
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
    const sort = (searchParams.get("sort")?.trim() || "newest") as
      | "price_asc"
      | "price_desc"
      | "rating"
      | "popular"
      | "newest";
    const inStockParam = searchParams.get("inStock");
    const filters =
      inStockParam !== null && inStockParam !== undefined
        ? { inStock: inStockParam === "true" }
        : undefined;

    const result = await runProductSearch({
      query: q,
      categoryId: category ?? undefined,
      subcategoryId: subcategory ?? undefined,
      filters,
      sort: ["price_asc", "price_desc", "rating", "popular", "newest"].includes(sort)
        ? sort
        : "newest",
      limit,
      offset,
    });

    return withPublicApiCors(NextResponse.json(result));
  } catch (err) {
    console.error("Products search GET error:", err);
    return withPublicApiCors(
      NextResponse.json({ error: "Failed to search products" }, { status: 500 }),
    );
  }
}

/**
 * Search products with category context and filters (POST body).
 * POST /api/products/search
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
        return withPublicApiCors(
          NextResponse.json(
            {
              error:
                "category or subcategory required when filtering by category",
            },
            { status: 400 },
          ),
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

    return withPublicApiCors(NextResponse.json(result));
  } catch (err) {
    console.error("Products search error:", err);
    return withPublicApiCors(
      NextResponse.json(
        { error: "Failed to search products" },
        { status: 500 },
      ),
    );
  }
}
