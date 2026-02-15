import { type NextRequest, NextResponse } from "next/server";

import {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  runProductSearch,
} from "~/lib/product-search";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

const SEMANTIC_MAX_LIMIT = 50;

/**
 * Natural-language product search for AI agents.
 * POST /api/products/semantic-search
 * Example: "cozy winter jacket under $100" -> query "cozy winter jacket", priceRange max 100.
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

    const result = await runProductSearch({
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
      limit,
      offset: 0,
      query: query || undefined,
      sort: priceMax != null ? "price_asc" : "newest",
    });

    return NextResponse.json(
      {
        ...result,
        _parsed: { priceMax, priceMin, query: query || rawQuery },
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
