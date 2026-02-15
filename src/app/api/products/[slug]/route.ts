import type { NextRequest } from "next/server";

import { withPublicApiCors } from "~/lib/cors-public-api";
import { getProductBySlugOrId } from "~/lib/product-by-slug";
import { apiError, apiSuccess } from "~/lib/api-error";

/** Always return fresh product data so variants (e.g. Printful size/color) are never stale on customer frontend. */
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  const { publicApiCorsPreflight } = await import("~/lib/cors-public-api");
  return publicApiCorsPreflight();
}

/**
 * Single product details by slug. 404 if not found or not published.
 * Example: GET /api/products/mens-bitcoin-hodl-tee
 * GET /api/products/[slug]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug: slugParam } = await params;
    if (!slugParam?.trim()) {
      return withPublicApiCors(
        apiError("MISSING_REQUIRED_FIELD", { field: "slug" }),
      );
    }

    const data = await getProductBySlugOrId(slugParam.trim());
    if (!data) {
      return withPublicApiCors(
        apiError("PRODUCT_NOT_FOUND", { slug: slugParam.trim() }),
      );
    }

    const productSlug = data.slug ?? data.id;
    return withPublicApiCors(
      apiSuccess({
        ...data,
        _actions: {
          addToCart: "POST /api/cart/estimate",
          checkout: "POST /api/checkout",
          related: `/api/products/${productSlug}/related`,
          variants: `/api/products/${productSlug}/variants`,
        },
      }),
    );
  } catch (err) {
    console.error("Product by slug error:", err);
    return withPublicApiCors(apiError("INTERNAL_ERROR"));
  }
}
