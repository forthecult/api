/**
 * Delete all product images for Seeed (and other) seeded products that have broken/placeholder images.
 * Run before re-seeding so seed data image URLs are re-inserted and can be re-uploaded to UploadThing.
 *
 * Usage: bun run scripts/delete-seed-product-images.ts
 */

import "dotenv/config";

import { eq, inArray } from "drizzle-orm";

import { db } from "../src/db";
import {
  productImagesTable,
  productsTable,
  productVariantsTable,
} from "../src/db/schema";

/** Product IDs that currently show blank/placeholder images and should be reset for re-seed + re-upload. */
const PRODUCT_IDS_TO_RESET = [
  "sensecap-watcher-w1-a",
  "linkstar-h68k-1432-v2",
  "xiao-smart-ir-mate",
  "trmnl-7-5-og-diy-kit",
];

async function main() {
  console.log(
    `Deleting product images for: ${PRODUCT_IDS_TO_RESET.join(", ")}`,
  );

  const deletedImages = await db
    .delete(productImagesTable)
    .where(inArray(productImagesTable.productId, PRODUCT_IDS_TO_RESET))
    .returning({ id: productImagesTable.id });
  console.log(`  Deleted ${deletedImages.length} product_image row(s).`);

  const updatedProducts = await db
    .update(productsTable)
    .set({ imageUrl: null, updatedAt: new Date() })
    .where(inArray(productsTable.id, PRODUCT_IDS_TO_RESET))
    .returning({ id: productsTable.id });
  console.log(`  Cleared imageUrl for ${updatedProducts.length} product(s).`);

  const updatedVariants = await db
    .update(productVariantsTable)
    .set({ imageUrl: null, updatedAt: new Date() })
    .where(inArray(productVariantsTable.productId, PRODUCT_IDS_TO_RESET))
    .returning({ id: productVariantsTable.id });
  console.log(`  Cleared imageUrl for ${updatedVariants.length} variant(s).`);

  console.log(
    "Done. Next: run seed-products.ts then upload-curated-product-images.ts.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
