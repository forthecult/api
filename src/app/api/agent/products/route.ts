import { type NextRequest, NextResponse } from "next/server";

import {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  runProductSearch,
} from "~/lib/product-search";

const AGENT_PRODUCTS_MAX_LIMIT = 50;
const DESCRIPTION_MAX_LENGTH = 200;

/**
 * GET /api/agent/products
 *
 * Agent-optimized product list: minimal, consistent schema for bots.
 * Optional: ?q=... (search), ?limit=... (default 20, max 50), ?offset=...
 * No auth required; use for discovery. For authenticated agent context use X-Moltbook-Identity and GET /api/agent/me.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q")?.trim() ?? undefined;
    const limit = Math.min(
      AGENT_PRODUCTS_MAX_LIMIT,
      Math.max(1, Number(searchParams.get("limit")) || DEFAULT_SEARCH_LIMIT),
    );
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

    const result = await runProductSearch({
      query: q ?? "",
      limit,
      offset,
      sort: "newest",
    });

    const products = result.products.map((p) => ({
      id: p.id,
      slug: p.slug ?? null,
      name: p.name,
      priceUsd: p.price.usd,
      inStock: p.inStock,
      imageUrl: p.imageUrl ?? null,
      description: truncateForAgent(p.description),
      categoryId: p.category ?? null,
    }));

    return NextResponse.json(
      {
        products,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        _hint: "Use id or slug with GET /api/products/{slug} for full details and variants.",
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60",
        },
      },
    );
  } catch (err) {
    console.error("[agent/products]", err);
    return NextResponse.json(
      { error: "Failed to list products", products: [], total: 0 },
      { status: 500 },
    );
  }
}

function truncateForAgent(description: string | undefined): string | null {
  if (!description || typeof description !== "string") return null;
  const trimmed = description.trim();
  if (!trimmed) return null;
  const oneLine = trimmed.replace(/\s+/g, " ").slice(0, DESCRIPTION_MAX_LENGTH);
  return oneLine.length < trimmed.length ? `${oneLine}…` : oneLine;
}
