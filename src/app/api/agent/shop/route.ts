import { type NextRequest, NextResponse } from "next/server";

import { headers } from "next/headers";

import {
  isAmazonProductApiConfigured,
  searchAmazonProducts,
} from "~/lib/amazon-product-api";
import {
  DEFAULT_SEARCH_LIMIT,
  runProductSearch,
} from "~/lib/product-search";
import type { ProductSearchResultItem } from "~/lib/product-search";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

const SHOP_MAX_LIMIT = 20;

type SourceFilter = "all" | "store" | "marketplace";

interface ShopRequest {
  message: string;
  context?: {
    priceRange?: { min?: number; max?: number };
    preferences?: string[];
    category?: string;
  };
}

interface ShopProduct {
  id: string;
  title: string;
  price: number;
  currency: string;
  rating?: number;
  reviewCount?: number;
  imageUrl?: string;
  productUrl?: string;
  source: "store" | "marketplace";
  inStock: boolean;
  badge?: string;
}

interface ShopResponse {
  reply: string;
  products: ShopProduct[];
  _parsed?: {
    query: string;
    priceMin?: number;
    priceMax?: number;
    category?: string;
  };
}

function parseSource(s: string | null | undefined): SourceFilter {
  if (s === "store" || s === "marketplace" || s === "all") return s;
  return "all";
}

function mapStoreProduct(p: ProductSearchResultItem & { source?: string; badge?: string }): ShopProduct {
  return {
    id: p.id,
    title: p.name,
    price: p.price.usd,
    currency: "USD",
    imageUrl: p.imageUrl,
    source: "store",
    inStock: p.inStock,
    badge: p.badge,
  };
}

function mapMarketplaceProduct(
  p: { asin: string; name: string; price: { usd: number }; imageUrl?: string; inStock: boolean; productUrl: string },
): ShopProduct {
  return {
    id: p.asin,
    title: p.name,
    price: p.price.usd,
    currency: "USD",
    imageUrl: p.imageUrl,
    productUrl: p.productUrl,
    source: "marketplace",
    inStock: p.inStock,
  };
}

function generateAiReply(
  message: string,
  products: ShopProduct[],
  parsed: { query: string; priceMin?: number; priceMax?: number },
): string {
  if (products.length === 0) {
    return `I couldn't find any products matching "${message}". Try broadening your search or checking a different category.`;
  }

  const priceContext = parsed.priceMax
    ? ` under $${parsed.priceMax}`
    : parsed.priceMin
      ? ` over $${parsed.priceMin}`
      : "";

  const count = products.length;
  const topProduct = products[0];
  const priceRange = products.length > 1
    ? `from $${Math.min(...products.map((p) => p.price)).toFixed(2)} to $${Math.max(...products.map((p) => p.price)).toFixed(2)}`
    : `at $${topProduct?.price.toFixed(2)}`;

  const storeCount = products.filter((p) => p.source === "store").length;
  const marketplaceCount = products.filter((p) => p.source === "marketplace").length;

  let sourceNote = "";
  if (storeCount > 0 && marketplaceCount > 0) {
    sourceNote = ` I found options from both our curated store (${storeCount}) and marketplace (${marketplaceCount}).`;
  } else if (marketplaceCount > 0) {
    sourceNote = " These are from our marketplace partners.";
  }

  const hasNew = products.some((p) => p.badge === "new");
  const hasTrending = products.some((p) => p.badge === "trending");
  const hasBestseller = products.some((p) => p.badge === "bestseller");

  let badgeNote = "";
  if (hasBestseller) badgeNote = " Including some bestsellers!";
  else if (hasTrending) badgeNote = " Some of these are trending right now.";
  else if (hasNew) badgeNote = " I've included some new arrivals.";

  return `I found ${count} great option${count > 1 ? "s" : ""}${priceContext} ${priceRange}.${sourceNote}${badgeNote} ${topProduct ? `Top pick: "${topProduct.title}" for $${topProduct.price.toFixed(2)}.` : ""}`;
}

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

/**
 * AI-powered shopping assistant endpoint.
 * Natural language in, structured products + AI reply out.
 * POST /api/agent/shop
 *
 * Request:
 * {
 *   "message": "wireless noise-canceling headphones under $200",
 *   "context": {
 *     "priceRange": { "max": 200 },
 *     "preferences": ["good battery life", "comfortable"]
 *   }
 * }
 *
 * Response:
 * {
 *   "reply": "I found some great wireless noise-canceling headphones under $200...",
 *   "products": [{ "id": "...", "title": "...", "price": 198.00, ... }]
 * }
 */
export async function POST(request: NextRequest) {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const rl = await checkRateLimit(`agent:shop:${ip}`, RATE_LIMITS.search);
  if (!rl.success) {
    return rateLimitResponse(rl, RATE_LIMITS.search.limit);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as ShopRequest & { source?: string };
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json(
        {
          error: {
            code: "MISSING_MESSAGE",
            message: "message field is required",
            suggestions: [
              "Provide a natural language shopping request",
              "Example: { \"message\": \"comfortable running shoes under $150\" }",
            ],
          },
        },
        { status: 400, headers: getRateLimitHeaders(rl, RATE_LIMITS.search.limit) },
      );
    }

    if (message.length > 1000) {
      return NextResponse.json(
        {
          error: {
            code: "MESSAGE_TOO_LONG",
            message: "message must be 1000 characters or less",
          },
        },
        { status: 400, headers: getRateLimitHeaders(rl, RATE_LIMITS.search.limit) },
      );
    }

    const { priceMax: parsedPriceMax, priceMin: parsedPriceMin, query } = parseSemanticQuery(message);

    const priceMin = body.context?.priceRange?.min ?? parsedPriceMin;
    const priceMax = body.context?.priceRange?.max ?? parsedPriceMax;
    const category = body.context?.category;
    const source = parseSource(body.source);

    const amazonConfigured = isAmazonProductApiConfigured();
    const wantStore = source === "all" || source === "store";
    const wantMarketplace = source === "all" || source === "marketplace";

    const limit = SHOP_MAX_LIMIT;
    const halfLimit = wantMarketplace && wantStore ? Math.ceil(limit / 2) : limit;

    const [storeResult, marketplaceResult] = await Promise.all([
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
              ...(category ? { category } : {}),
            },
            limit: halfLimit,
            offset: 0,
            query: query || undefined,
            sort: priceMax != null ? "price_asc" : "newest",
          })
        : null,
      wantMarketplace && amazonConfigured
        ? searchAmazonProducts({
            query: query || message,
            limit: Math.min(10, halfLimit),
            page: 1,
            ...(priceMin != null ? { minPrice: priceMin } : {}),
            ...(priceMax != null ? { maxPrice: priceMax } : {}),
          }).catch((err) => {
            console.warn("Marketplace shop search failed:", err);
            return { products: [], totalResultCount: 0 };
          })
        : null,
    ]);

    const storeProducts = (storeResult?.products ?? []).map(mapStoreProduct);
    const marketplaceProducts = (marketplaceResult?.products ?? []).map(mapMarketplaceProduct);

    let products: ShopProduct[];
    if (source === "store") {
      products = storeProducts.slice(0, limit);
    } else if (source === "marketplace") {
      products = marketplaceProducts.slice(0, limit);
    } else {
      products = [...storeProducts, ...marketplaceProducts].slice(0, limit);
    }

    const parsed = { query: query || message, priceMin, priceMax, category };
    const reply = generateAiReply(message, products, parsed);

    const response: ShopResponse = {
      reply,
      products,
      _parsed: parsed,
    };

    return NextResponse.json(response, {
      headers: {
        ...getRateLimitHeaders(rl, RATE_LIMITS.search.limit),
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err) {
    console.error("Agent shop error:", err);
    return NextResponse.json(
      {
        error: {
          code: "SHOP_ERROR",
          message: "Failed to process shopping request",
          suggestions: ["Try a simpler query", "Check if the service is available"],
        },
      },
      { status: 500 },
    );
  }
}
