import { type NextRequest, NextResponse } from "next/server";

import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";
import {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  runProductSearch,
} from "~/lib/product-search";

const SEMANTIC_MAX_LIMIT = 50;

/** Parse natural language into query text and optional price range (USD). */
function parseSemanticQuery(q: string): {
  query: string;
  priceMin?: number;
  priceMax?: number;
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

  return { query, priceMin, priceMax };
}

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
      query?: string;
      limit?: number;
    };
    const rawQuery = typeof body.query === "string" ? body.query.trim() : "";
    if (!rawQuery) {
      return NextResponse.json(
        {
          error: "query is required",
          products: [],
          total: 0,
          limit: DEFAULT_SEARCH_LIMIT,
        },
        { status: 400 },
      );
    }

    const { query, priceMin, priceMax } = parseSemanticQuery(rawQuery);
    const limit = Math.min(
      SEMANTIC_MAX_LIMIT,
      Math.max(1, Number(body.limit) || DEFAULT_SEARCH_LIMIT),
    );

    const result = await runProductSearch({
      query: query || undefined,
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
      sort: priceMax != null ? "price_asc" : "newest",
      limit,
      offset: 0,
    });

    return NextResponse.json(
      {
        ...result,
        _parsed: { query: query || rawQuery, priceMin, priceMax },
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
        products: [],
        total: 0,
        limit: DEFAULT_SEARCH_LIMIT,
      },
      { status: 500 },
    );
  }
}
