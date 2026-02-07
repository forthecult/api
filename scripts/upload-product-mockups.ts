/**
 * Upload product mockups from Printful/Printify CDNs to UploadThing:
 * - Fetches each image, optimizes to WebP, renames for SEO, sets alt text, uploads to UploadThing
 * - Updates product_image, product.imageUrl, and product_variant.imageUrl to the new URLs
 *
 * Run after syncing Printful/Printify products. Requires UPLOADTHING_TOKEN in .env.
 *
 * Usage: bun run scripts/upload-product-mockups.ts [--dry-run] [--product-id=xxx]
 * - --dry-run: collect URLs and log what would be uploaded, do not upload or update DB
 * - --product-id=xxx: only process this product (and its images/variants)
 */

import "dotenv/config";

import { eq, inArray, or } from "drizzle-orm";
import { UTApi } from "uploadthing/server";

import { db } from "../src/db";
import {
  productImagesTable,
  productVariantsTable,
  productsTable,
} from "../src/db/schema";
import {
  buildSeoAlt,
  buildSeoFilename,
  isProviderImageUrl,
  isUploadThingUrl,
  uploadMockupToUploadThing,
} from "../src/lib/product-mockup-upload";
import { getUploadThingToken, validateUploadThingToken } from "../src/lib/uploadthing-token";

type UrlMeta = {
  url: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  index: number;
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const productIdArg = process.argv.find((a) => a.startsWith("--product-id="));
  const singleProductId = productIdArg?.slice("--product-id=".length) ?? null;

  if (!dryRun) {
    const token = getUploadThingToken();
    if (!token) {
      console.error(
        "UPLOADTHING_TOKEN not set. Add it in .env (no quotes). See docs/UPLOADTHING.md",
      );
      process.exit(1);
    }
    if (!validateUploadThingToken(token)) {
      console.error(
        "UPLOADTHING_TOKEN is invalid. Use the V7 token (base64 JSON with apiKey, appId, regions).",
      );
      process.exit(1);
    }
  }

  // Products from Printful or Printify
  const productWhere =
    singleProductId != null
      ? eq(productsTable.id, singleProductId)
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
    console.log("No Printful/Printify products found.");
    process.exit(0);
  }

  // Product images (url, productId, sortOrder)
  const productIds = products.map((p) => p.id);
  const images = await db
    .select({
      productId: productImagesTable.productId,
      url: productImagesTable.url,
      sortOrder: productImagesTable.sortOrder,
    })
    .from(productImagesTable)
    .where(inArray(productImagesTable.productId, productIds));

  // Variants (imageUrl, productId, color/size for label)
  const variants = await db
    .select({
      productId: productVariantsTable.productId,
      imageUrl: productVariantsTable.imageUrl,
      color: productVariantsTable.color,
      size: productVariantsTable.size,
    })
    .from(productVariantsTable)
    .where(inArray(productVariantsTable.productId, productIds));

  const nameById = new Map(products.map((p) => [p.id, p.name]));

  // Collect all provider image URLs with metadata (first occurrence wins for dedupe)
  const urlToMeta = new Map<string, UrlMeta>();
  for (const p of products) {
    if (p.imageUrl && isProviderImageUrl(p.imageUrl) && !isUploadThingUrl(p.imageUrl)) {
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
    if (v.imageUrl && isProviderImageUrl(v.imageUrl) && !isUploadThingUrl(v.imageUrl)) {
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

  const toUpload = [...urlToMeta.values()];
  if (toUpload.length === 0) {
    console.log("No Printful/Printify image URLs to upload (all may already be on UploadThing).");
    process.exit(0);
  }

  console.log(`Found ${toUpload.length} unique mockup URL(s) to process.`);

  if (dryRun) {
    for (const m of toUpload) {
      const filename = buildSeoFilename(m.productName, {
        variantLabel: m.variantLabel,
        index: m.index,
      });
      const alt = buildSeoAlt(m.productName, {
        variantLabel: m.variantLabel,
        index: m.index,
      });
      console.log(`  [dry-run] ${m.url} → ${filename} | alt: ${alt}`);
    }
    console.log("Dry run done. Run without --dry-run to upload and update DB.");
    process.exit(0);
  }

  const utapi = new UTApi({ token });
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
      console.log(`  Uploaded: ${result.filename} → ${result.url}`);
    }
  }

  // Update DB: replace old URLs with new URLs (and set alt where applicable)
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

  console.log(
    `Done. Updated: ${updatedImages} product_image(s), ${updatedProducts} product(s) imageUrl, ${updatedVariants} variant(s) imageUrl.`,
  );
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
