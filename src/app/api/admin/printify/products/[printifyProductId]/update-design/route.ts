/**
 * POST /api/admin/printify/products/[printifyProductId]/update-design
 *
 * Replace the product's print design with a new image (e.g. transparent background).
 * Fetches the product, updates print_areas to use the new image id, PUTs to Printify,
 * then triggers publish so mockups regenerate.
 *
 * Body: { imageId: string }
 */

import { type NextRequest, NextResponse } from "next/server";

import {
  fetchPrintifyProduct,
  updatePrintifyProduct,
  publishPrintifyProduct,
  getPrintifyIfConfigured,
} from "~/lib/printify";
import { getAdminAuth } from "~/lib/admin-api-auth";

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

  let body: { imageId?: string };
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

  try {
    const product = await fetchPrintifyProduct(pf.shopId, printifyProductId);

    const print_areas = product.print_areas.map((pa) => ({
      variant_ids: pa.variant_ids,
      placeholders: pa.placeholders.map((ph) => ({
        position: ph.position,
        images: ph.images.map((img) => ({
          id: imageId,
          x: img.x,
          y: img.y,
          scale: img.scale,
          angle: img.angle,
        })),
      })),
    }));

    await updatePrintifyProduct(pf.shopId, printifyProductId, { print_areas });

    await publishPrintifyProduct(pf.shopId, printifyProductId).catch(() => {});

    return NextResponse.json({
      ok: true,
      printifyProductId,
      message: "Design updated and publish triggered; mockups will regenerate.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
