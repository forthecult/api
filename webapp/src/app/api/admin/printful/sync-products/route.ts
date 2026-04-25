import { createId } from "@paralleldrive/cuid2";
import { eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { productsTable, productVariantsTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import {
  fetchCatalogProduct,
  fetchCatalogVariants,
  fetchProductSizeGuide,
  fetchVariantPrices,
} from "~/lib/printful";

/**
 * Admin-only: sync one Printful catalog product into our backend.
 * Creates one Product + many ProductVariants (same schema as manual products).
 * - New sync: POST with catalogProductId → create new product + variants.
 * - Re-sync: POST with catalogProductId and productId → update existing product + variants from Printful.
 * Printful catalog is read-only in API v2; edits in our admin update our DB only, not Printful.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const body = (await request.json().catch(() => ({}))) as {
      catalogProductId?: number;
      productId?: string;
    };
    const catalogProductId =
      typeof body.catalogProductId === "number"
        ? body.catalogProductId
        : Number.parseInt(
            request.nextUrl.searchParams.get("catalogProductId") ?? "",
            10,
          );
    const productId =
      body.productId ??
      request.nextUrl.searchParams.get("productId") ??
      undefined;

    if (!Number.isFinite(catalogProductId) || catalogProductId <= 0) {
      return NextResponse.json(
        { error: "catalogProductId (Printful catalog product ID) is required" },
        { status: 400 },
      );
    }

    const [productRes, variantsRes, sizeGuideRes] = await Promise.all([
      fetchCatalogProduct(catalogProductId),
      fetchCatalogVariants(catalogProductId),
      fetchProductSizeGuide(catalogProductId).catch(() => null),
    ]);

    const catalogProduct = productRes.data;
    const variants = variantsRes.data ?? [];
    const sizeGuideJson = sizeGuideRes?.data
      ? JSON.stringify(sizeGuideRes.data)
      : null;

    const now = new Date();
    const isReSync = typeof productId === "string" && productId.length > 0;

    let ourProductId: string;
    if (isReSync) {
      const [existing] = await db
        .select({ externalId: productsTable.externalId, id: productsTable.id })
        .from(productsTable)
        .where(eq(productsTable.id, productId))
        .limit(1);
      if (!existing || existing.externalId !== String(catalogProductId)) {
        return NextResponse.json(
          {
            error:
              "productId not found or does not match this Printful catalog product",
          },
          { status: 400 },
        );
      }
      ourProductId = productId;
      await db
        .update(productsTable)
        .set({
          brand: catalogProduct.brand ?? null,
          description: catalogProduct.description ?? null,
          imageUrl: catalogProduct.image ?? null,
          name: catalogProduct.name,
          published: !catalogProduct.is_discontinued,
          sizeGuideJson,
          updatedAt: now,
        })
        .where(eq(productsTable.id, ourProductId));
    } else {
      ourProductId = createId();
      await db.insert(productsTable).values({
        brand: catalogProduct.brand ?? null,
        createdAt: now,
        description: catalogProduct.description ?? null,
        externalId: String(catalogProductId),
        id: ourProductId,
        imageUrl: catalogProduct.image ?? null,
        metaDescription: null,
        name: catalogProduct.name,
        priceCents: 0,
        published: !catalogProduct.is_discontinued,
        sizeGuideJson,
        slug: null,
        source: "printful",
        updatedAt: now,
        weightGrams: null,
      });
      const { applyCategoryAutoRules } = await import(
        "~/lib/category-auto-assign"
      );
      await applyCategoryAutoRules({
        brand: catalogProduct.brand ?? null,
        createdAt: now,
        id: ourProductId,
        name: catalogProduct.name,
      });
    }

    const variantIdsToKeep: string[] = [];
    let minPriceCents = 0;

    for (const variant of variants) {
      let priceCents = 0;
      try {
        const priceRes = await fetchVariantPrices(variant.id, {
          currency: "USD",
          selling_region_name: "worldwide",
        });
        const firstTechnique = priceRes.data?.variant?.techniques?.[0];
        if (
          firstTechnique?.discounted_price != null ||
          firstTechnique?.price != null
        ) {
          const priceStr =
            firstTechnique.discounted_price ?? firstTechnique.price ?? "0";
          priceCents = Math.round(Number.parseFloat(priceStr) * 100);
        }
      } catch {
        // leave 0 if rate limit or error
      }
      if (minPriceCents === 0 || priceCents < minPriceCents)
        minPriceCents = priceCents;

      const variantRowId = `printful-v-${variant.id}`;
      variantIdsToKeep.push(variantRowId);

      await db
        .insert(productVariantsTable)
        .values({
          color: variant.color ?? null,
          colorCode: variant.color_code ?? null,
          createdAt: now,
          externalId: String(variant.id),
          id: variantRowId,
          imageUrl: variant.image ?? null,
          priceCents: Math.max(0, priceCents),
          productId: ourProductId,
          size: variant.size ?? null,
          sku: null,
          stockQuantity: null,
          updatedAt: now,
          weightGrams: null,
        })
        .onConflictDoUpdate({
          set: {
            color: variant.color ?? null,
            colorCode: variant.color_code ?? null,
            imageUrl: variant.image ?? null,
            priceCents: Math.max(0, priceCents),
            size: variant.size ?? null,
            updatedAt: now,
          },
          target: productVariantsTable.id,
        });
    }

    if (minPriceCents > 0) {
      await db
        .update(productsTable)
        .set({ priceCents: minPriceCents, updatedAt: now })
        .where(eq(productsTable.id, ourProductId));
    }

    if (isReSync && variantIdsToKeep.length > 0) {
      const existing = await db
        .select({ id: productVariantsTable.id })
        .from(productVariantsTable)
        .where(eq(productVariantsTable.productId, ourProductId));
      const idsToDelete = existing
        .filter((r) => !variantIdsToKeep.includes(r.id))
        .map((r) => r.id);
      if (idsToDelete.length > 0) {
        await db
          .delete(productVariantsTable)
          .where(inArray(productVariantsTable.id, idsToDelete));
      }
    }

    return NextResponse.json({
      catalogProductId,
      productId: ourProductId,
      reSync: isReSync,
      variantsCount: variants.length,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("PRINTFUL_API_TOKEN")) {
      return NextResponse.json(
        { error: "Printful is not configured" },
        { status: 503 },
      );
    }
    console.error("Printful sync-products error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 },
    );
  }
}
