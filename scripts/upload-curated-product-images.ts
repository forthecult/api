/**
 * Upload curated product images (Trezor Safe 7, Trezor Safe 5, HUSKYLENS 2, Cryptomatic Jetsetter) to UploadThing.
 * Fetches each image from the source URL (trezor.io, dfrobot.com), optimizes to WebP,
 * uploads to UploadThing, and updates product_image + product.imageUrl in the database.
 *
 * Run after seeding products. Requires UPLOADTHING_TOKEN in .env.
 *
 * Usage: bun run scripts/upload-curated-product-images.ts [--dry-run]
 * - --dry-run: log what would be uploaded, do not upload or update DB
 */

import "dotenv/config";

import { eq } from "drizzle-orm";
import { UTApi } from "uploadthing/server";

import { db } from "../src/db";
import {
  productImagesTable,
  productsTable,
} from "../src/db/schema";
import { isUploadThingUrl, uploadMockupToUploadThing } from "../src/lib/product-mockup-upload";
import { getUploadThingToken, validateUploadThingToken } from "../src/lib/uploadthing-token";

import { CRYPTOMATIC_JETSETTER } from "./seed-data/cryptomatic-jetsetter";
import { HUSKYLENS_2 } from "./seed-data/huskylens-2";
import { TREZOR_SAFE_5 } from "./seed-data/trezor-safe-5";
import { TREZOR_SAFE_7 } from "./seed-data/trezor-safe-7";

const CURATED_PRODUCTS = [
  { id: TREZOR_SAFE_7.id, name: TREZOR_SAFE_7.name, images: TREZOR_SAFE_7.images ?? [] },
  { id: TREZOR_SAFE_5.id, name: TREZOR_SAFE_5.name, images: TREZOR_SAFE_5.images ?? [] },
  { id: HUSKYLENS_2.id, name: HUSKYLENS_2.name, images: HUSKYLENS_2.images ?? [] },
  { id: CRYPTOMATIC_JETSETTER.id, name: CRYPTOMATIC_JETSETTER.name, images: CRYPTOMATIC_JETSETTER.images ?? [] },
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");

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

  const toUpload: Array<{
    productId: string;
    productName: string;
    sourceUrl: string;
    alt: string;
    title: string;
    index: number;
  }> = [];

  for (const p of CURATED_PRODUCTS) {
    if (!p.images?.length) continue;
    for (let i = 0; i < p.images.length; i++) {
      const img = p.images[i]!;
      if (!img.url || isUploadThingUrl(img.url)) continue;
      toUpload.push({
        productId: p.id,
        productName: p.name,
        sourceUrl: img.url,
        alt: img.alt ?? "",
        title: img.title ?? "",
        index: i,
      });
    }
  }

  if (toUpload.length === 0) {
    console.log("No curated product image URLs to upload (all may already be on UploadThing).");
    process.exit(0);
  }

  console.log(`Found ${toUpload.length} image(s) to upload.`);

  if (dryRun) {
    for (const m of toUpload) {
      console.log(`  [dry-run] ${m.productId} #${m.index}: ${m.sourceUrl} → ${m.alt || "(no alt)"}`);
    }
    console.log("Dry run done. Run without --dry-run to upload and update DB.");
    process.exit(0);
  }

  const utapi = new UTApi({ token: getUploadThingToken()! });
  const urlToNew = new Map<string, { newUrl: string; alt: string }>();

  for (const m of toUpload) {
    const result = await uploadMockupToUploadThing(utapi, {
      sourceUrl: m.sourceUrl,
      productName: m.productName,
      alt: m.alt || undefined,
      index: m.index,
    });
    if (result) {
      urlToNew.set(m.sourceUrl, { newUrl: result.url, alt: result.alt });
      console.log(`  Uploaded: ${result.filename} → ${result.url}`);
    }
  }

  if (urlToNew.size === 0) {
    console.log("No images were successfully uploaded. Check source URLs and token.");
    process.exit(1);
  }

  let updatedImages = 0;
  let updatedProducts = 0;

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
  }

  console.log(
    `Done. Updated: ${updatedImages} product_image(s), ${updatedProducts} product(s) imageUrl.`,
  );
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
