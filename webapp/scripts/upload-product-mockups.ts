/**
 * Upload product mockups from Printful/Printify CDNs to UploadThing:
 * - Fetches each image, optimizes to WebP, renames for SEO, sets alt text, uploads to UploadThing
 * - Updates product_image, product.imageUrl, and product_variant.imageUrl to the new URLs
 *
 * Run after syncing Printful/Printify products. Requires UPLOADTHING_TOKEN in .env.
 *
 * Usage: bun run scripts/upload-product-mockups.ts [--dry-run] [--product-id=xxx]
 * - --dry-run: list which URLs would be uploaded and the filenames/alts; no upload or DB changes
 * - --product-id=xxx: only process this product (and its images/variants)
 */

import "dotenv/config";

import { UTApi } from "uploadthing/server";

import {
  getProductMockupsToUpload,
  uploadProductMockupsForProduct,
  buildSeoFilename,
  buildSeoAlt,
} from "../src/lib/upload-product-mockups";
import {
  getUploadThingToken,
  validateUploadThingToken,
} from "../src/lib/uploadthing-token";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const productIdArg = process.argv.find((a) => a.startsWith("--product-id="));
  const singleProductId =
    productIdArg?.slice("--product-id=".length).trim() || null;

  const toUpload = await getProductMockupsToUpload(singleProductId ?? null);

  if (toUpload.length === 0) {
    console.log(
      singleProductId
        ? "No Printful/Printify image URLs to upload for this product (or product not found)."
        : "No Printful/Printify products with provider image URLs found (all may already be on UploadThing).",
    );
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

  const utapi = new UTApi({ token });
  const result = await uploadProductMockupsForProduct(utapi, singleProductId);

  console.log(
    `Done. Updated: ${result.updatedImages} product_image(s), ${result.updatedProducts} product(s) imageUrl, ${result.updatedVariants} variant(s) imageUrl.`,
  );
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
