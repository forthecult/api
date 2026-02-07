/**
 * Seeds the database with demo products. Categories must exist (run seed-categories first).
 * Real reviews are seeded separately via seed-reviews.ts (from data/reviews.csv).
 * Run: bun run scripts/seed-products.ts
 */

import "dotenv/config";

import { db } from "../src/db";
import { productCategoriesTable, productsTable } from "../src/db/schema";

const now = new Date();

/**
 * No demo/mock products in staging or production. Products are added via admin or sync (Printful/Printify).
 * For local dev only, you can add items to this array; they will be skipped when the array is empty.
 */
const DEMO_PRODUCTS: Array<{
  id: string;
  name: string;
  imageUrl: string;
  priceCents: number;
  categoryId: string;
  brand: string;
  description: string;
}> = [];

async function seed() {
  console.log(
    "Seeding products… (run seed-categories.ts first to create categories)",
  );
  await db
    .insert(productsTable)
    .values(
      DEMO_PRODUCTS.map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        priceCents: p.priceCents,
        description: p.description,
        brand: p.brand,
        source: "manual",
        published: true,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing({ target: productsTable.id });

  console.log("Linking products to categories…");
  await db
    .insert(productCategoriesTable)
    .values(
      DEMO_PRODUCTS.map((p) => ({
        productId: p.id,
        categoryId: p.categoryId,
        isMain: true,
      })),
    )
    .onConflictDoNothing({
      target: [
        productCategoriesTable.productId,
        productCategoriesTable.categoryId,
      ],
    });

  console.log(
    "Done. Demo products are in the database. Reviews are production data only.",
  );
}

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
