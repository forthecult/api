import { type NextRequest, NextResponse } from "next/server";

import type { ProductSearchResultItem } from "~/lib/product-search";

import {
  isAmazonProductApiConfigured,
  searchAmazonProducts,
} from "~/lib/amazon-product-api";
import { DEFAULT_SEARCH_LIMIT, runProductSearch } from "~/lib/product-search";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

const SEMANTIC_MAX_LIMIT = 50;

type SourceFilter = "all" | "amazon" | "store";

/**
 * Natural-language product search for AI agents.
 * Supports source=all|store|amazon. Example: "cozy winter jacket under $100" -> query + priceRange max 100.
 * POST /api/products/semantic-search
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`semantic-search:${ip}`, RATE_LIMITS.search);
  if (!rl.success) {
    return rateLimitResponse(rl, RATE_LIMITS.search.limit);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      limit?: number;
      query?: string;
      source?: string;
    };
    const rawQuery = typeof body.query === "string" ? body.query.trim() : "";
    if (!rawQuery) {
      return NextResponse.json(
        {
          error: "query is required",
          limit: DEFAULT_SEARCH_LIMIT,
          products: [],
          total: 0,
        },
        { status: 400 },
      );
    }

    const { priceMax, priceMin, query } = parseSemanticQuery(rawQuery);
    const limit = Math.min(
      SEMANTIC_MAX_LIMIT,
      Math.max(1, Number(body.limit) || DEFAULT_SEARCH_LIMIT),
    );
    const source = parseSource(body.source);

    const amazonConfigured = isAmazonProductApiConfigured();
    const wantStore = source === "all" || source === "store";
    const wantAmazon = source === "all" || source === "amazon";

    const halfLimit = wantAmazon && wantStore ? Math.ceil(limit / 2) : limit;

    const [storeResult, amazonResult] = await Promise.all([
      wantStore
        ? runProductSearch({
            filters: {
              ...(priceMin != null || priceMax != null
                ? {
                    priceRange: {
                      ...(priceMin != null ? { min: priceMin } : {}),
                      ...(priceMax != null ? { max: priceMax } : {}),
                    },
                  }
                : {}),
            },
            limit: halfLimit,
            offset: 0,
            query: query || undefined,
            sort: priceMax != null ? "price_asc" : "newest",
          })
        : null,
      wantAmazon && amazonConfigured
        ? searchAmazonProducts({
            limit: Math.min(10, halfLimit),
            page: 1,
            query: query || rawQuery,
          }).catch((err) => {
            console.warn("Marketplace semantic search failed:", err);
            return { products: [], totalResultCount: 0 };
          })
        : null,
    ]);

    if (source === "store" || (source === "all" && !amazonConfigured)) {
      const result = storeResult ?? {
        limit,
        offset: 0,
        products: [],
        total: 0,
      };
      return NextResponse.json(
        {
          ...result,
          _parsed: { priceMax, priceMin, query: query || rawQuery },
        },
        { headers: getRateLimitHeaders(rl, RATE_LIMITS.search.limit) },
      );
    }

    if (source === "amazon" && amazonConfigured) {
      const products = (amazonResult?.products ?? []).map(
        mapAmazonToSearchItem,
      );
      return NextResponse.json(
        {
          _parsed: { priceMax, priceMin, query: query || rawQuery },
          limit,
          offset: 0,
          products,
          total: amazonResult?.totalResultCount ?? products.length,
        },
        { headers: getRateLimitHeaders(rl, RATE_LIMITS.search.limit) },
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

    return NextResponse.json(
      {
        _parsed: { priceMax, priceMin, query: query || rawQuery },
        limit,
        offset: 0,
        products: merged,
        total,
      },
      {
        headers: getRateLimitHeaders(rl, RATE_LIMITS.search.limit),
      },
    );
  } catch (err) {
    console.error("Semantic search error:", err);
    return NextResponse.json(
      {
        error: "Failed to search products",
        limit: DEFAULT_SEARCH_LIMIT,
        products: [],
        total: 0,
      },
      { status: 500 },
    );
  }
}

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

/** Parse natural language into query text and optional price range (USD). */
function parseSemanticQuery(q: string): {
  priceMax?: number;
  priceMin?: number;
  query: string;
} {
  let query = q.trim();
  let priceMin: number | undefined;
  let priceMax: number | undefined;

  const underMatch = query.match(
    /\bunder\s*\$\s*(\d+(?:\.\d+)?)|under\s+(\d+)\s*(?:dollars?|usd)?/i,
  );
  if (underMatch) {
    priceMax = Number.parseFloat(underMatch[1] ?? underMatch[2] ?? "0");
    query = query.replace(underMatch[0], "").replace(/\s+/g, " ").trim();
  }

  const overMatch = query.match(
    /\b(?:over|above)\s*\$\s*(\d+(?:\.\d+)?)|(?:over|above)\s+(\d+)\s*(?:dollars?|usd)?/i,
  );
  if (overMatch) {
    priceMin = Number.parseFloat(overMatch[1] ?? overMatch[2] ?? "0");
    query = query.replace(overMatch[0], "").replace(/\s+/g, " ").trim();
  }

  return { priceMax, priceMin, query };
}

function parseSource(s: null | string | undefined): SourceFilter {
  if (s === "store" || s === "amazon" || s === "all") return s;
  return "all";
}
