/**
 * Upload product mockups (Printful/Printify CDN → UploadThing) for one or all products.
 * Used by scripts/upload-product-mockups.ts and POST /api/admin/products/[id]/upload-mockups.
 */

import { eq, inArray, or } from "drizzle-orm";
import type { UTApi } from "uploadthing/server";

import { db } from "~/db";
import {
  productImagesTable,
  productVariantsTable,
  productsTable,
} from "~/db/schema";
import {
  buildSeoAlt,
  buildSeoFilename,
  isProviderImageUrl,
  isUploadThingUrl,
  uploadMockupToUploadThing,
} from "~/lib/product-mockup-upload";

export type UploadMockupsResult = {
  uploaded: number;
  updatedImages: number;
  updatedProducts: number;
  updatedVariants: number;
};

type UrlMeta = {
  url: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  index: number;
};

/**
 * Collect all Printful/Printify image URLs for the given product(s).
 * productId can be a single id or null for "all Printful/Printify products".
 */
async function collectProviderUrls(productId: string | null): Promise<{
  products: { id: string; name: string; imageUrl: string | null }[];
  toUpload: UrlMeta[];
}> {
  const productWhere =
    productId != null
      ? eq(productsTable.id, productId)
      : or(
          eq(productsTable.source, "printful"),
          eq(productsTable.source, "printify"),
        );

  const products = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      imageUrl: productsTable.imageUrl,
    })
    .from(productsTable)
    .where(productWhere);

  if (products.length === 0) {
    return { products, toUpload: [] };
  }

  const ids = products.map((p) => p.id);
  const nameById = new Map(products.map((p) => [p.id, p.name]));

  const [images, variants] = await Promise.all([
    db
      .select({
        productId: productImagesTable.productId,
        url: productImagesTable.url,
        sortOrder: productImagesTable.sortOrder,
      })
      .from(productImagesTable)
      .where(inArray(productImagesTable.productId, ids)),
    db
      .select({
        productId: productVariantsTable.productId,
        imageUrl: productVariantsTable.imageUrl,
        color: productVariantsTable.color,
        size: productVariantsTable.size,
      })
      .from(productVariantsTable)
      .where(inArray(productVariantsTable.productId, ids)),
  ]);

  const urlToMeta = new Map<string, UrlMeta>();
  for (const p of products) {
    if (
      p.imageUrl &&
      isProviderImageUrl(p.imageUrl) &&
      !isUploadThingUrl(p.imageUrl)
    ) {
      if (!urlToMeta.has(p.imageUrl)) {
        urlToMeta.set(p.imageUrl, {
          url: p.imageUrl,
          productId: p.id,
          productName: p.name,
          variantLabel: null,
          index: 0,
        });
      }
    }
  }
  for (const img of images) {
    if (img.url && isProviderImageUrl(img.url) && !isUploadThingUrl(img.url)) {
      if (!urlToMeta.has(img.url)) {
        const productName = nameById.get(img.productId) ?? "Product";
        urlToMeta.set(img.url, {
          url: img.url,
          productId: img.productId,
          productName,
          variantLabel: null,
          index: img.sortOrder ?? 0,
        });
      }
    }
  }
  for (const v of variants) {
    if (
      v.imageUrl &&
      isProviderImageUrl(v.imageUrl) &&
      !isUploadThingUrl(v.imageUrl)
    ) {
      if (!urlToMeta.has(v.imageUrl)) {
        const productName = nameById.get(v.productId) ?? "Product";
        const variantLabel = [v.color, v.size].filter(Boolean).join(" ") || null;
        urlToMeta.set(v.imageUrl, {
          url: v.imageUrl,
          productId: v.productId,
          productName,
          variantLabel,
          index: 0,
        });
      }
    }
  }
  return { products, toUpload: [...urlToMeta.values()] };
}

/**
 * Return list of provider image URLs that would be uploaded (for dry-run).
 */
export async function getProductMockupsToUpload(
  productId: string | null,
): Promise<UrlMeta[]> {
  const { toUpload } = await collectProviderUrls(productId);
  return toUpload;
}

/**
 * Upload mockup images for one product (or all Printful/Printify products) to UploadThing.
 * Fetches from CDN, optimizes to WebP, applies SEO filename/alt, updates DB.
 *
 * @param utapi - UTApi instance (caller must ensure UPLOADTHING_TOKEN is set)
 * @param productId - Single product id, or null to process all Printful/Printify products
 */
export async function uploadProductMockupsForProduct(
  utapi: UTApi,
  productId: string | null,
): Promise<UploadMockupsResult> {
  const { toUpload } = await collectProviderUrls(productId);
  if (toUpload.length === 0) {
    return { uploaded: 0, updatedImages: 0, updatedProducts: 0, updatedVariants: 0 };
  }

  const urlToNew = new Map<string, { newUrl: string; alt: string }>();
  for (const m of toUpload) {
    const result = await uploadMockupToUploadThing(utapi, {
      sourceUrl: m.url,
      productName: m.productName,
      variantLabel: m.variantLabel,
      index: m.index,
    });
    if (result) {
      urlToNew.set(m.url, { newUrl: result.url, alt: result.alt });
    }
  }

  let updatedImages = 0;
  let updatedProducts = 0;
  let updatedVariants = 0;

  for (const [oldUrl, { newUrl, alt }] of urlToNew) {
    const imageRows = await db
      .update(productImagesTable)
      .set({ url: newUrl, alt })
      .where(eq(productImagesTable.url, oldUrl))
      .returning({ id: productImagesTable.id });
    updatedImages += imageRows.length;

    const productRows = await db
      .update(productsTable)
      .set({ imageUrl: newUrl, updatedAt: new Date() })
      .where(eq(productsTable.imageUrl, oldUrl))
      .returning({ id: productsTable.id });
    updatedProducts += productRows.length;

    const variantRows = await db
      .update(productVariantsTable)
      .set({
        imageUrl: newUrl,
        imageAlt: alt,
        updatedAt: new Date(),
      })
      .where(eq(productVariantsTable.imageUrl, oldUrl))
      .returning({ id: productVariantsTable.id });
    updatedVariants += variantRows.length;
  }

  return {
    uploaded: urlToNew.size,
    updatedImages,
    updatedProducts,
    updatedVariants,
  };
}

export { buildSeoFilename, buildSeoAlt, isProviderImageUrl, isUploadThingUrl };

/**
 * Trigger mockup upload for a single product (e.g. after Printful/Printify sync).
 * No-op if UPLOADTHING_TOKEN is missing or invalid. Safe to call fire-and-forget.
 */
export async function triggerMockupUploadForProduct(
  productId: string,
): Promise<{ ran: boolean; uploaded?: number }> {
  const { getUploadThingToken, validateUploadThingToken } = await import(
    "~/lib/uploadthing-token"
  );
  const token = getUploadThingToken();
  if (!token || !validateUploadThingToken(token)) {
    return { ran: false };
  }
  const { UTApi } = await import("uploadthing/server");
  const utapi = new UTApi({ token });
  const result = await uploadProductMockupsForProduct(utapi, productId);
  return { ran: true, uploaded: result.uploaded };
}
