import { type NextRequest, NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";

import { getAdminAuth } from "~/lib/admin-api-auth";
import {
  createSyncProduct,
  fetchCatalogVariants,
  getPrintfulIfConfigured,
} from "~/lib/printful";
import { importSinglePrintfulProduct } from "~/lib/printful-sync";
import { triggerMockupUploadForProduct } from "~/lib/upload-product-mockups";
import { getUploadThingToken } from "~/lib/uploadthing-token";

/**
 * POST /api/admin/printful/create-products
 *
 * General-purpose endpoint: create one or more Printful products from a print image.
 *
 * Body (JSON):
 * {
 *   imageBase64: string;          // PNG image as base64
 *   imageName?: string;           // filename (default: "design.png")
 *   products: Array<{
 *     catalogProductId: number;   // Printful V2 catalog product ID (e.g. 71 = Bella+Canvas 3001)
 *     title: string;
 *     description?: string;
 *     color: string;              // Color name to filter variants (e.g. "White", "Black")
 *     sizes?: string[];           // Sizes to include (e.g. ["S","M","L","XL","2XL"]). Omit for all.
 *     priceCents: number;         // Retail price in cents
 *     tags?: string[];
 *     position?: string;          // Print position (default: "front")
 *   }>;
 * }
 *
 * Returns:
 * { results: Array<{ success, title, syncProductId, localProductId, error? }> }
 */
export async function POST(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return NextResponse.json(
      { error: "Printful not configured. Set PRINTFUL_API_TOKEN." },
      { status: 400 },
    );
  }

  const utToken = getUploadThingToken();
  if (!utToken) {
    return NextResponse.json(
      { error: "UPLOADTHING_TOKEN not set." },
      { status: 503 },
    );
  }

  let body: {
    imageBase64?: string;
    imageName?: string;
    products?: {
      catalogProductId?: number;
      color?: string;
      description?: string;
      position?: string;
      priceCents?: number;
      sizes?: string[];
      tags?: string[];
      title?: string;
    }[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !body.imageBase64 ||
    !Array.isArray(body.products) ||
    body.products.length === 0
  ) {
    return NextResponse.json(
      { error: "imageBase64 and products[] are required" },
      { status: 400 },
    );
  }

  // 1. Upload image to UploadThing (raw PNG, no conversion)
  let imageUrl: string;
  try {
    const buffer = Buffer.from(body.imageBase64, "base64");
    const filename = body.imageName ?? "design.png";
    const file = new File([new Uint8Array(buffer)], filename, {
      type: "image/png",
    });
    const utapi = new UTApi({ token: utToken });
    const result = await utapi.uploadFiles(file);
    const payload = Array.isArray(result) ? result[0] : result;
    const err =
      payload && typeof payload === "object"
        ? (payload as { error?: unknown }).error
        : undefined;
    if (err) throw new Error("UploadThing upload failed");

    const data =
      payload &&
      typeof payload === "object" &&
      (payload as { data?: unknown }).data != null
        ? (payload as { data: Record<string, unknown> }).data
        : (payload as null | Record<string, unknown>);
    const fromData =
      data && typeof data === "object"
        ? ((data as { ufsUrl?: string }).ufsUrl ??
          (data as { url?: string }).url ??
          null)
        : null;
    const fromPayload =
      payload && typeof payload === "object"
        ? ((payload as { ufsUrl?: string }).ufsUrl ??
          (payload as { url?: string }).url ??
          null)
        : null;
    const url =
      (typeof fromData === "string" ? fromData : null) ??
      (typeof fromPayload === "string" ? fromPayload : null);

    if (!url) throw new Error("UploadThing returned no URL");
    imageUrl = url;
    console.log(
      "Printful create-products: image uploaded to UploadThing:",
      imageUrl,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Image upload failed: ${msg}` },
      { status: 500 },
    );
  }

  // 2. Create each product
  const results: {
    error?: string;
    localProductId?: string;
    success: boolean;
    syncProductId?: number;
    title: string;
    variantCount?: number;
  }[] = [];

  for (const spec of body.products) {
    const {
      catalogProductId,
      color,
      description,
      position,
      priceCents,
      sizes,
      tags,
      title,
    } = spec;

    if (!catalogProductId || !title || !color || !priceCents) {
      results.push({
        error: "catalogProductId, title, color, and priceCents are required",
        success: false,
        title: title ?? "unknown",
      });
      continue;
    }

    try {
      // Fetch catalog variants for this product
      const variantsRes = await fetchCatalogVariants(catalogProductId);
      const allVariants = variantsRes.data;

      // Filter by color (case-insensitive)
      const colorLower = color.toLowerCase();
      let filtered = allVariants.filter(
        (v) => v.color?.toLowerCase() === colorLower,
      );
      if (filtered.length === 0) {
        // Try partial match
        filtered = allVariants.filter((v) =>
          v.color?.toLowerCase().includes(colorLower),
        );
      }

      if (filtered.length === 0) {
        const availableColors = [
          ...new Set(allVariants.map((v) => v.color).filter(Boolean)),
        ];
        results.push({
          error: `No variants found for color "${color}". Available: ${availableColors.join(", ")}`,
          success: false,
          title,
        });
        continue;
      }

      // Filter by sizes if specified
      if (sizes && sizes.length > 0) {
        const sizesLower = sizes.map((s) => s.toLowerCase());
        filtered = filtered.filter(
          (v) => v.size && sizesLower.includes(v.size.toLowerCase()),
        );
      }

      if (filtered.length === 0) {
        results.push({
          error: `No variants found after filtering by sizes`,
          success: false,
          title,
        });
        continue;
      }

      // Build sync variants
      const syncVariants = filtered.map((v) => ({
        files: [
          {
            type:
              (position ?? "front") === "front"
                ? "default"
                : (position ?? "front"),
            url: imageUrl,
          },
        ],
        retail_price: (priceCents / 100).toFixed(2),
        variant_id: v.id,
      }));

      // Create sync product in Printful
      const syncProduct = await createSyncProduct({
        sync_product: {
          name: title,
          thumbnail: imageUrl,
        },
        sync_variants: syncVariants,
      });

      console.log(
        `Printful create-products: created sync product ${syncProduct.id} "${title}" with ${filtered.length} variants`,
      );

      // Import to local DB
      let localProductId: string | undefined;
      try {
        const imported = await importSinglePrintfulProduct(
          syncProduct.id,
          false,
        );
        localProductId = imported?.productId;
        console.log(
          `Printful create-products: imported to local DB: ${localProductId}`,
        );
      } catch (e) {
        console.warn("Printful create-products: import to DB failed:", e);
      }

      // Add tags to product if specified
      if (tags && tags.length > 0 && localProductId) {
        try {
          const { productTagsTable } = await import("~/db/schema");
          const { db } = await import("~/db");
          for (const tag of tags) {
            await db
              .insert(productTagsTable)
              .values({ productId: localProductId, tag })
              .onConflictDoNothing()
              .catch(() => {});
          }
        } catch (e) {
          console.warn("Printful create-products: tag insert failed:", e);
        }
      }

      results.push({
        localProductId,
        success: true,
        syncProductId: syncProduct.id,
        title,
        variantCount: filtered.length,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ error: msg, success: false, title });
    }
  }

  // 3. Wait for Printful to generate mockups, then upload to UploadThing
  const successfulProducts = results.filter(
    (r) => r.success && r.localProductId,
  );
  if (successfulProducts.length > 0) {
    console.log(
      `Printful create-products: waiting 90s for Printful mockup generation...`,
    );
    await new Promise((resolve) => setTimeout(resolve, 90_000));

    // Re-sync to get mockup URLs
    for (const r of successfulProducts) {
      if (r.syncProductId) {
        try {
          await importSinglePrintfulProduct(r.syncProductId, true);
        } catch (e) {
          console.warn(`Re-sync failed for ${r.title}:`, e);
        }
      }
    }

    // Upload mockups to UploadThing
    for (const r of successfulProducts) {
      if (r.localProductId) {
        try {
          await triggerMockupUploadForProduct(r.localProductId);
        } catch (e) {
          console.warn(`Mockup upload failed for ${r.title}:`, e);
        }
      }
    }
  }

  return NextResponse.json({
    imageUrl,
    message: `Created ${results.filter((r) => r.success).length}/${results.length} products`,
    ok: true,
    results,
  });
}
