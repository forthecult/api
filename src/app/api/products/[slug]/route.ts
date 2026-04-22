import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "~/lib/api-error";
import { withPublicApiCors } from "~/lib/cors-public-api";
import { getProductBySlugOrId } from "~/lib/product-by-slug";

// short revalidate keeps variant / inventory edits visible within seconds
// without forcing dynamic on every request. the underlying Cache-Control
// header on the response still instructs CDNs appropriately.
export const revalidate = 30;

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

export async function OPTIONS() {
  const { publicApiCorsPreflight } = await import("~/lib/cors-public-api");
  return publicApiCorsPreflight();
}
