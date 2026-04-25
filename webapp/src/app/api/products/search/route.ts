import { type NextRequest, NextResponse } from "next/server";

import type { ProductSearchResultItem } from "~/lib/product-search";

import {
  isAmazonProductApiConfigured,
  searchAmazonProducts,
} from "~/lib/amazon-product-api";
import {
  publicApiCorsPreflight,
  withPublicApiCors,
} from "~/lib/cors-public-api";
import {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  runProductSearch,
} from "~/lib/product-search";

interface SearchBody {
  category?: string;
  filters?: {
    brand?: string[];
    inStock?: boolean;
    priceRange?: { max?: number; min?: number };
    rating?: string;
  };
  limit?: number;
  offset?: number;
  query?: string;
  sort?: "newest" | "popular" | "price_asc" | "price_desc" | "rating";
  source?: "all" | "amazon" | "store";
  subcategory?: string;
}

type SourceFilter = "all" | "amazon" | "store";

/**
 * Search products via GET (query params). When source=all (default), returns both store and marketplace products.
 * Use source=store for store-only, source=amazon for marketplace-only.
 * CORS: Allow-Origin * (see cors-public-api).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q")?.trim() ?? undefined;
    const category = searchParams.get("category")?.trim() ?? undefined;
    const subcategory = searchParams.get("subcategory")?.trim() ?? undefined;
    const source = parseSource(searchParams.get("source"));
    const limit = Math.min(
      MAX_SEARCH_LIMIT,
      Math.max(1, Number(searchParams.get("limit")) || DEFAULT_SEARCH_LIMIT),
    );
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
    const sort = (searchParams.get("sort")?.trim() || "newest") as
      | "newest"
      | "popular"
      | "price_asc"
      | "price_desc"
      | "rating";
    const inStockParam = searchParams.get("inStock");
    const filters =
      inStockParam !== null && inStockParam !== undefined
        ? { inStock: inStockParam === "true" }
        : undefined;

    const amazonConfigured = isAmazonProductApiConfigured();
    const wantStore = source === "all" || source === "store";
    const wantAmazon =
      (source === "all" || source === "amazon") &&
      amazonConfigured &&
      (q?.length ?? 0) > 0;

    const halfLimit = wantAmazon && wantStore ? Math.ceil(limit / 2) : limit;
    const [storeResult, amazonResult] = await Promise.all([
      wantStore
        ? runProductSearch({
            categoryId: category ?? undefined,
            filters,
            limit: halfLimit,
            offset,
            query: q,
            sort: [
              "newest",
              "popular",
              "price_asc",
              "price_desc",
              "rating",
            ].includes(sort)
              ? sort
              : "newest",
            subcategoryId: subcategory ?? undefined,
          })
        : null,
      wantAmazon
        ? searchAmazonProducts({
            limit: Math.min(10, halfLimit),
            page: Math.floor(offset / limit) + 1,
            query: q ?? "",
          }).catch((err) => {
            console.warn("Marketplace search failed:", err);
            return { products: [], totalResultCount: 0 };
          })
        : null,
    ]);

    if (source === "store" || (source === "all" && !amazonConfigured)) {
      const result = storeResult ?? { limit, offset, products: [], total: 0 };
      return withPublicApiCors(NextResponse.json(result));
    }

    if (source === "amazon" && amazonConfigured) {
      const products = (amazonResult?.products ?? []).map(
        mapAmazonToSearchItem,
      );
      return withPublicApiCors(
        NextResponse.json({
          limit,
          offset,
          products,
          total: amazonResult?.totalResultCount ?? products.length,
        }),
      );
    }

    const storeProducts = (storeResult?.products ?? []).map((p) => ({
      ...p,
      source: "store" as const,
    }));
    const amazonProducts = (amazonResult?.products ?? []).map(
      mapAmazonToSearchItem,
    );
    const merged = [...storeProducts, ...amazonProducts].slice(0, limit);
    const total =
      (storeResult?.total ?? 0) + (amazonResult?.totalResultCount ?? 0);

    return withPublicApiCors(
      NextResponse.json({
        limit,
        offset,
        products: merged,
        total,
      }),
    );
  } catch (err) {
    console.error("Products search GET error:", err);
    return withPublicApiCors(
      NextResponse.json(
        { error: "Failed to search products" },
        { status: 500 },
      ),
    );
  }
}

export async function OPTIONS() {
  return publicApiCorsPreflight();
}

/**
 * Search products with category context and filters (POST body).
 * Supports source=all|store|amazon like GET.
 * POST /api/products/search
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SearchBody;
    const categoryId =
      typeof body.category === "string" ? body.category.trim() : null;
    const subcategoryId =
      typeof body.subcategory === "string" ? body.subcategory.trim() : null;
    const source = parseSource(body.source ?? null);
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

    const amazonConfigured = isAmazonProductApiConfigured();
    const wantStore = source === "all" || source === "store";
    const wantAmazon =
      (source === "all" || source === "amazon") &&
      amazonConfigured &&
      (typeof body.query === "string" ? body.query.trim() : "").length > 0;

    const halfLimit = wantAmazon && wantStore ? Math.ceil(limit / 2) : limit;

    const [storeResult, amazonResult] = await Promise.all([
      wantStore
        ? runProductSearch({
            categoryId: categoryId ?? undefined,
            filters: body.filters,
            limit: halfLimit,
            offset,
            query: body.query,
            sort: body.sort ?? "newest",
            subcategoryId: subcategoryId ?? undefined,
          })
        : null,
      wantAmazon
        ? searchAmazonProducts({
            limit: Math.min(10, halfLimit),
            page: Math.floor(offset / limit) + 1,
            query: typeof body.query === "string" ? body.query.trim() : "",
          }).catch((err) => {
            console.warn("Marketplace search failed:", err);
            return { products: [], totalResultCount: 0 };
          })
        : null,
    ]);

    if (source === "store" || (source === "all" && !amazonConfigured)) {
      const result = storeResult ?? { limit, offset, products: [], total: 0 };
      return withPublicApiCors(NextResponse.json(result));
    }

    if (source === "amazon" && amazonConfigured) {
      const products = (amazonResult?.products ?? []).map(
        mapAmazonToSearchItem,
      );
      return withPublicApiCors(
        NextResponse.json({
          limit,
          offset,
          products,
          total: amazonResult?.totalResultCount ?? products.length,
        }),
      );
    }

    const storeProducts = (storeResult?.products ?? []).map((p) => ({
      ...p,
      source: "store" as const,
    }));
    const amazonProducts = (amazonResult?.products ?? []).map(
      mapAmazonToSearchItem,
    );
    const merged = [...storeProducts, ...amazonProducts].slice(0, limit);
    const total =
      (storeResult?.total ?? 0) + (amazonResult?.totalResultCount ?? 0);

    return withPublicApiCors(
      NextResponse.json({
        limit,
        offset,
        products: merged,
        total,
      }),
    );
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

/** Map marketplace products to the same shape as store results; id = asin for checkout. Public API uses "marketplace" (no vendor names). */
function mapAmazonToSearchItem(p: {
  asin: string;
  imageUrl?: string;
  inStock: boolean;
  name: string;
  price: { usd: number };
  productUrl: string;
}): ProductSearchResultItem & { productUrl: string; source: "marketplace" } {
  return {
    id: p.asin,
    imageUrl: p.imageUrl,
    inStock: p.inStock,
    name: p.name,
    price: { crypto: {}, usd: p.price.usd },
    productUrl: p.productUrl,
    source: "marketplace",
  };
}

function parseSource(s: null | string): SourceFilter {
  if (s === "store" || s === "amazon" || s === "all") return s;
  return "all";
}
