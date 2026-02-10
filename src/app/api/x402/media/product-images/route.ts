import { type NextRequest, NextResponse } from "next/server";

import { getBulkProductPricesAndImages } from "~/lib/x402-rates";

const MAX_IDS = 200;

/**
 * POST /api/x402/media/product-images
 * Body: { productIds: string[] } — bulk product image URLs (main + gallery).
 * Free for agents: no payment required.
 */
export async function POST(request: NextRequest) {
  let body: { productIds?: string[] };
  try {
    body = (await request.json()) as { productIds?: string[] };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body; expected { productIds: string[] }" },
      { status: 400 },
    );
  }
  const raw = body?.productIds;
  const productIds = Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === "string").slice(0, MAX_IDS)
    : [];
  if (productIds.length === 0) {
    return NextResponse.json(
      { error: "productIds array required (max 200)", products: [] },
      { status: 400 },
    );
  }
  const products = await getBulkProductPricesAndImages(productIds);
  return NextResponse.json({
    products: products.map((p) => ({
      productId: p.productId,
      imageUrl: p.imageUrl,
      imageUrls: p.imageUrls.length ? p.imageUrls : (p.imageUrl ? [p.imageUrl] : []),
    })),
    total: products.length,
  });
}
