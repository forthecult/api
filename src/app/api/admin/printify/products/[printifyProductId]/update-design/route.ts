/**
 * POST /api/admin/printify/products/[printifyProductId]/update-design
 *
 * Replace the product's print design with a single image (e.g. transparent PNG).
 * Use the transparent design file only; do not add a separate background image layer.
 * The product's own "Background color" in Printify (per variant) is separate — set that
 * in the Printify editor (e.g. to Black) so the product surface shows the right color.
 *
 * Body: { imageId: string, coverCanvas?: boolean }
 * When coverCanvas is true, design layer uses a larger scale so the image covers the full print area.
 */

import { type NextRequest, NextResponse } from "next/server";

import { getAdminAuth } from "~/lib/admin-api-auth";
import {
  fetchPrintifyProduct,
  getPrintifyIfConfigured,
  publishPrintifyProduct,
  updatePrintifyProduct,
} from "~/lib/printify";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ printifyProductId: string }> },
) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pf = getPrintifyIfConfigured();
  if (!pf) {
    return NextResponse.json(
      { error: "Printify not configured." },
      { status: 400 },
    );
  }

  const { printifyProductId } = await context.params;
  if (!printifyProductId) {
    return NextResponse.json(
      { error: "printifyProductId is required" },
      { status: 400 },
    );
  }

  let body: { imageId?: string; coverCanvas?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const imageId = body.imageId?.trim();
  if (!imageId) {
    return NextResponse.json(
      { error: "body.imageId is required" },
      { status: 400 },
    );
  }
  const coverCanvas = body.coverCanvas === true;
  const designScale = coverCanvas ? 2.5 : 1;

  try {
    const product = await fetchPrintifyProduct(pf.shopId, printifyProductId);

    const defaultDesignImage = {
      angle: 0,
      id: imageId,
      scale: designScale,
      x: 0.5,
      y: 0.5,
    };

    const print_areas = product.print_areas.map((pa) => ({
      placeholders: pa.placeholders.map((ph) => {
        const designImages =
          ph.images && ph.images.length > 0
            ? ph.images.map((img) => ({
                angle: img.angle,
                id: imageId,
                scale: coverCanvas ? designScale : img.scale,
                x: img.x,
                y: img.y,
              }))
            : [defaultDesignImage];
        return {
          images: designImages,
          position: ph.position,
        };
      }),
      variant_ids: pa.variant_ids,
    }));

    await updatePrintifyProduct(pf.shopId, printifyProductId, { print_areas });

    await publishPrintifyProduct(pf.shopId, printifyProductId).catch(() => {});

    return NextResponse.json({
      message: "Design updated and publish triggered; mockups will regenerate.",
      ok: true,
      printifyProductId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
