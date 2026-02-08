/**
 * Download, optimize (WebP), and upload ALL curated product images to UploadThing.
 * We do not serve vendor CDNs (e.g. Seeed Studio); the store must use UploadThing-hosted images only.
 * Seed data may contain vendor URLs as SOURCE ONLY; this script fetches them, optimizes, uploads to UT, and updates the DB.
 * Covers: Pacsafe (4), Earth Runners, Spout, Trezor Safe 7/5, HUSKYLENS 2, Cryptomatic Jetsetter, Home Assistant Green/Voice.
 *
 * Run after seeding products. Requires UPLOADTHING_TOKEN in .env.
 * Usage: bun run scripts/upload-curated-product-images.ts [--dry-run]
 */

import "dotenv/config";

import { asc, eq, isNull } from "drizzle-orm";
import { UTApi } from "uploadthing/server";

import { db } from "../src/db";
import {
  productImagesTable,
  productVariantsTable,
  productsTable,
} from "../src/db/schema";
import { isUploadThingUrl, uploadMockupToUploadThing } from "../src/lib/product-mockup-upload";
import { getUploadThingToken, validateUploadThingToken } from "../src/lib/uploadthing-token";

import { CRYPTOMATIC_JETSETTER } from "./seed-data/cryptomatic-jetsetter";
import { EARTH_RUNNERS_CIRCADIAN } from "./seed-data/earth-runners-circadian";
import { HOME_ASSISTANT_GREEN } from "./seed-data/home-assistant-green";
import { HOME_ASSISTANT_VOICE } from "./seed-data/home-assistant-voice";
import { HUSKYLENS_2 } from "./seed-data/huskylens-2";
import { PACSAFE_EXP_28L } from "./seed-data/pacsafe-exp-28l";
import { PACSAFE_RFIDSAFE_WALLET } from "./seed-data/pacsafe-rfidsafe-wallet";
import { PACSAFE_V_12L } from "./seed-data/pacsafe-v-12l";
import { PACSAFE_V_20L } from "./seed-data/pacsafe-v-20l";
import { SPOUT_MONOLITH } from "./seed-data/spout-monolith";
import { TREZOR_SAFE_5 } from "./seed-data/trezor-safe-5";
import { TREZOR_SAFE_7 } from "./seed-data/trezor-safe-7";

const CURATED_PRODUCTS = [
  PACSAFE_EXP_28L,
  PACSAFE_V_20L,
  PACSAFE_V_12L,
  PACSAFE_RFIDSAFE_WALLET,
  EARTH_RUNNERS_CIRCADIAN,
  SPOUT_MONOLITH,
  TREZOR_SAFE_7,
  TREZOR_SAFE_5,
  HUSKYLENS_2,
  CRYPTOMATIC_JETSETTER,
  HOME_ASSISTANT_GREEN,
  HOME_ASSISTANT_VOICE,
];

type ImageSpec = {
  sourceUrl: string;
  productId: string;
  productName: string;
  alt: string;
  variantLabel: string | null;
  index: number;
};

function collectImageSpecs(): ImageSpec[] {
  const seen = new Set<string>();
  const out: ImageSpec[] = [];

  for (const p of CURATED_PRODUCTS) {
    const name = p.name;
    const id = p.id;

    // Main product image
    const mainUrl = p.imageUrl;
    if (mainUrl && !isUploadThingUrl(mainUrl) && !seen.has(mainUrl)) {
      seen.add(mainUrl);
      out.push({
        sourceUrl: mainUrl,
        productId: id,
        productName: name,
        alt: (p as { mainImageAlt?: string }).mainImageAlt ?? `${name} main`,
        variantLabel: null,
        index: 0,
      });
    }

    // Gallery images
    const images = (p as { images?: Array<{ url: string; alt?: string; title?: string }> }).images ?? [];
    images.forEach((img, i) => {
      const url = img.url;
      if (!url || isUploadThingUrl(url) || seen.has(url)) return;
      seen.add(url);
      out.push({
        sourceUrl: url,
        productId: id,
        productName: name,
        alt: img.alt ?? "",
        variantLabel: null,
        index: i,
      });
    });

    // Variant images
    const variants = (p as { variants?: Array<{ imageUrl: string; imageAlt?: string; color?: string; size?: string }> }).variants ?? [];
    variants.forEach((v, i) => {
      const url = v.imageUrl;
      if (!url || isUploadThingUrl(url) || seen.has(url)) return;
      seen.add(url);
      const label = [v.color, v.size].filter(Boolean).join(" ") || null;
      out.push({
        sourceUrl: url,
        productId: id,
        productName: name,
        alt: v.imageAlt ?? (label ? `${name} ${label}` : `${name} variant`),
        variantLabel: label,
        index: i,
      });
    });
  }

  return out;
}

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

  const specs = collectImageSpecs();
  if (specs.length === 0) {
    console.log("No curated product image URLs to upload (all may already be on UploadThing).");
    process.exit(0);
  }

  console.log(`Found ${specs.length} image(s) to upload from ${CURATED_PRODUCTS.length} products.`);

  if (dryRun) {
    for (const s of specs) {
      console.log(`  [dry-run] ${s.productId}: ${s.sourceUrl.slice(0, 60)}... → ${s.alt || "(no alt)"}`);
    }
    console.log("Dry run done. Run without --dry-run to upload and update DB.");
    process.exit(0);
  }

  const utapi = new UTApi({ token: getUploadThingToken()! });
  const urlToNew = new Map<string, { newUrl: string; alt: string }>();

  for (const s of specs) {
    const result = await uploadMockupToUploadThing(utapi, {
      sourceUrl: s.sourceUrl,
      productName: s.productName,
      alt: s.alt || undefined,
      variantLabel: s.variantLabel,
      index: s.index,
    });
    if (result) {
      urlToNew.set(s.sourceUrl, { newUrl: result.url, alt: result.alt });
      console.log(`  Uploaded: ${result.filename} → ${result.url}`);
    }
  }

  if (urlToNew.size === 0) {
    console.log("No images were successfully uploaded. Check source URLs and token.");
    process.exit(1);
  }

  let updatedImages = 0;
  let updatedProducts = 0;
  let updatedVariants = 0;

  for (const [oldUrl, { newUrl, alt }] of urlToNew) {
    const imageRows = await db
      .update(productImagesTable)
      .set({ url: newUrl, alt })
      .where(eq(productImagesTable.url, oldUrl))
      .returning({ id: productImagesTable.id, productId: productImagesTable.productId });
    updatedImages += imageRows.length;

    // Update product.imageUrl where it matched oldUrl (primary image)
    const productRows = await db
      .update(productsTable)
      .set({ imageUrl: newUrl, updatedAt: new Date() })
      .where(eq(productsTable.imageUrl, oldUrl))
      .returning({ id: productsTable.id });
    updatedProducts += productRows.length;

    // Sync primary image from gallery for products whose imageUrl didn't match oldUrl (e.g. stale or null)
    const alreadyUpdatedIds = new Set(productRows.map((r) => r.id));
    const productIdsFromGallery = [...new Set(imageRows.map((r) => r.productId).filter(Boolean))];
    for (const pid of productIdsFromGallery) {
      if (alreadyUpdatedIds.has(pid!)) continue;
      const r = await db
        .update(productsTable)
        .set({ imageUrl: newUrl, updatedAt: new Date() })
        .where(eq(productsTable.id, pid!))
        .returning({ id: productsTable.id });
      updatedProducts += r.length;
    }

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

  // Backfill primary image from first gallery image for products where imageUrl is missing or not UploadThing
  const productsWithNullImage = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(isNull(productsTable.imageUrl));
  const allProductsWithImages = await db
    .select({ id: productsTable.id, imageUrl: productsTable.imageUrl })
    .from(productsTable)
    .innerJoin(
      productImagesTable,
      eq(productsTable.id, productImagesTable.productId),
    );
  const needsBackfill = new Set<string>();
  for (const p of productsWithNullImage) {
    needsBackfill.add(p.id);
  }
  for (const p of allProductsWithImages) {
    if (p.imageUrl && !isUploadThingUrl(p.imageUrl)) {
      needsBackfill.add(p.id);
    }
  }
  let backfillCount = 0;
  for (const productId of needsBackfill) {
    const firstImage = await db
      .select({ url: productImagesTable.url })
      .from(productImagesTable)
      .where(eq(productImagesTable.productId, productId))
      .orderBy(asc(productImagesTable.sortOrder))
      .limit(1);
    if (firstImage.length > 0 && firstImage[0]!.url) {
      await db
        .update(productsTable)
        .set({ imageUrl: firstImage[0]!.url, updatedAt: new Date() })
        .where(eq(productsTable.id, productId));
      backfillCount++;
    }
  }
  if (backfillCount > 0) {
    console.log(`Backfill: set primary image from gallery for ${backfillCount} product(s).`);
  }

  console.log(
    `Done. Updated: ${updatedImages} product_image(s), ${updatedProducts + backfillCount} product(s) imageUrl, ${updatedVariants} variant(s) imageUrl.`,
  );
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
