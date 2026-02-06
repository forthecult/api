/**
 * Links orphaned reviews to products by matching productSlug to product slug.
 *
 * Run this after adding new products to link any existing reviews that
 * were imported before the products existed.
 *
 * Run: bun run scripts/link-orphan-reviews.ts
 */

import "dotenv/config";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "../src/db";
import { productReviewsTable, productsTable } from "../src/db/schema";

async function linkOrphanReviews() {
  console.log("Linking orphaned reviews to products…");

  // Get all products with slugs
  const products = await db
    .select({
      id: productsTable.id,
      slug: productsTable.slug,
      name: productsTable.name,
    })
    .from(productsTable);

  const slugToProduct = new Map<string, { id: string; name: string }>();
  for (const p of products) {
    if (p.slug) {
      slugToProduct.set(p.slug, { id: p.id, name: p.name });
    }
  }

  console.log(`Found ${slugToProduct.size} products with slugs`);

  // Get orphaned reviews (have productSlug but no productId)
  const orphanedReviews = await db
    .select({
      id: productReviewsTable.id,
      productSlug: productReviewsTable.productSlug,
    })
    .from(productReviewsTable)
    .where(
      and(
        isNull(productReviewsTable.productId),
        // Only reviews that have a slug to match
      ),
    );

  console.log(`Found ${orphanedReviews.length} reviews without linked products`);

  let linked = 0;
  let notFound = 0;

  for (const review of orphanedReviews) {
    if (!review.productSlug) {
      notFound++;
      continue;
    }

    const product = slugToProduct.get(review.productSlug);
    if (!product) {
      notFound++;
      continue;
    }

    await db
      .update(productReviewsTable)
      .set({
        productId: product.id,
        productName: product.name,
        updatedAt: new Date(),
      })
      .where(eq(productReviewsTable.id, review.id));

    linked++;
  }

  console.log("\n--- Results ---");
  console.log(`Linked: ${linked} reviews`);
  console.log(`No matching product: ${notFound} reviews`);
  console.log("\nDone.");
}

linkOrphanReviews().catch((err) => {
  console.error("Link orphan reviews failed:", err);
  process.exit(1);
});
