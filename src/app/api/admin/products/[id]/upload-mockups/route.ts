/**
 * POST /api/admin/products/[id]/upload-mockups
 *
 * Re-host product images from POD provider CDN to UploadThing:
 * fetch, optimize to WebP, SEO filename/alt, upload, update product_image,
 * product.imageUrl, and product_variant.imageUrl.
 *
 * Only applies to products with POD source that still have provider image URLs.
 * Requires UPLOADTHING_TOKEN.
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";

import { db } from "~/db";
import { productsTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";
import {
  uploadProductMockupsForProduct,
  isProviderImageUrl,
  isUploadThingUrl,
} from "~/lib/upload-product-mockups";
import {
  getUploadThingToken,
  validateUploadThingToken,
} from "~/lib/uploadthing-token";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: param } = await params;
    const [byId] = await db
      .select({
        id: productsTable.id,
        source: productsTable.source,
        imageUrl: productsTable.imageUrl,
      })
      .from(productsTable)
      .where(eq(productsTable.id, param))
      .limit(1);
    const [bySlug] = byId
      ? []
      : await db
          .select({
            id: productsTable.id,
            source: productsTable.source,
            imageUrl: productsTable.imageUrl,
          })
          .from(productsTable)
          .where(eq(productsTable.slug, param))
          .limit(1);
    const product = byId ?? bySlug ?? null;

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const source = product.source?.toLowerCase();
    if (source !== "printful" && source !== "printify") {
      return NextResponse.json(
        {
          error:
            "Only POD-sourced products can have mockups re-hosted. This product is not from a POD provider.",
        },
        { status: 400 },
      );
    }

    const token = getUploadThingToken();
    if (!token) {
      return NextResponse.json(
        {
          error:
            "UPLOADTHING_TOKEN not set. Add it in .env to re-host images to UploadThing.",
        },
        { status: 400 },
      );
    }
    if (!validateUploadThingToken(token)) {
      return NextResponse.json(
        { error: "UPLOADTHING_TOKEN is invalid." },
        { status: 400 },
      );
    }

    const utapi = new UTApi({ token });
    const result = await uploadProductMockupsForProduct(utapi, product.id);

    if (result.uploaded === 0) {
      const hasProviderUrl =
        product.imageUrl && isProviderImageUrl(product.imageUrl);
      const alreadyUploadThing =
        product.imageUrl && isUploadThingUrl(product.imageUrl);
      return NextResponse.json({
        success: true,
        message: alreadyUploadThing
          ? "Images are already hosted on UploadThing."
          : hasProviderUrl
            ? "No provider image URLs to process (check product images and variants)."
            : "No POD provider image URLs found for this product.",
        ...result,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Re-hosted ${result.uploaded} image(s) to UploadThing.`,
      ...result,
    });
  } catch (err) {
    console.error("Upload mockups error:", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 },
    );
  }
}
