/**
 * POST /api/admin/printify/products/[printifyProductId]/update-design
 *
 * Replace the product's print design with a single image (e.g. transparent PNG).
 * Optionally enable only "Black" variants (product background color) so the product
 * surface is black instead of white.
 *
 * Body: { imageId: string, coverCanvas?: boolean, enableBlackBackgroundOnly?: boolean }
 * When coverCanvas is true, design layer uses a larger scale so the image covers the full print area.
 * When enableBlackBackgroundOnly is true, we disable non-Black variants so only Black remains.
 */

import { type NextRequest, NextResponse } from "next/server";

import type { PrintifyProduct } from "~/lib/printify";

import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
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
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

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

  let body: {
    coverCanvas?: boolean;
    enableBlackBackgroundOnly?: boolean;
    imageId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
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
  const enableBlackBackgroundOnly = body.enableBlackBackgroundOnly === true;
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

    if (enableBlackBackgroundOnly) {
      const variantsPayload = variantsWithBlackOnly(product);
      if (variantsPayload?.some((v) => v.is_enabled))
        await updatePrintifyProduct(pf.shopId, printifyProductId, {
          variants: variantsPayload,
        });
    }

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

/** Find option index and value id for Black if present (Background color, Color, Base colors, etc.). */
function findBlackOption(
  product: PrintifyProduct,
): null | { blackValueId: number; optionIndex: number } {
  for (let i = 0; i < (product.options?.length ?? 0); i++) {
    const opt = product.options![i];
    if (!opt?.values) continue;
    for (const v of opt.values) {
      const t = String(v.title).trim().toLowerCase();
      if (t === "black" || t.startsWith("black "))
        return { blackValueId: v.id, optionIndex: i };
    }
  }
  return null;
}

/** Build variants payload: enable only variants that have the Black option value. */
function variantsWithBlackOnly(product: PrintifyProduct):
  | null
  | {
      id: number;
      is_enabled: boolean;
      price: number;
    }[] {
  const black = findBlackOption(product);
  if (!black) return null;
  const { blackValueId, optionIndex } = black;
  return product.variants.map((v) => ({
    id: v.id,
    is_enabled: v.options?.[optionIndex] === blackValueId,
    price: v.price,
  }));
}
