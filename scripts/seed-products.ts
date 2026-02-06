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
 * Demo products for staging/production. Categories must exist (run seed-categories.ts first).
 * Mock/test products (e.g. "Test Product — $1") are not included; add those only in local dev if needed.
 */
const DEMO_PRODUCTS = [
  {
    id: "1",
    name: "Premium Wireless Headphones",
    imageUrl:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    priceCents: 19999,
    categoryId: "accessories-tech",
    brand: "AudioMax",
    description:
      "Experience crystal-clear sound with our premium wireless headphones. Featuring active noise cancellation, 30-hour battery life, and comfortable over-ear design.",
  },
  {
    id: "2",
    name: "Smart Watch Series 5",
    imageUrl:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    priceCents: 29999,
    categoryId: "accessories-watches",
    brand: "TechFit",
    description:
      "Stay connected and track your fitness goals with our advanced smartwatch. Features health monitoring, GPS tracking, and a beautiful always-on display.",
  },
  {
    id: "3",
    name: "Professional Camera Kit",
    imageUrl:
      "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    priceCents: 129999,
    categoryId: "accessories-tech",
    brand: "OptiPro",
    description:
      "Capture stunning photos and videos with our professional camera kit. Includes a high-resolution sensor, 4K video recording, and a versatile lens kit.",
  },
  {
    id: "4",
    name: "Ergonomic Office Chair",
    imageUrl:
      "https://images.unsplash.com/photo-1506377295352-e3154d43ea9e?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    priceCents: 24999,
    categoryId: "home-living",
    brand: "ErgoComfort",
    description:
      "Work in comfort with our ergonomic office chair designed for all-day support. Features adjustable height, lumbar support, and breathable mesh back.",
  },
  {
    id: "5",
    name: "Smartphone Pro Max",
    imageUrl:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    priceCents: 99999,
    categoryId: "accessories-tech",
    brand: "TechPro",
    description:
      "The ultimate smartphone experience with a stunning display, powerful camera system, and all-day battery life.",
  },
  {
    id: "6",
    name: 'Ultra HD Smart TV 55"',
    imageUrl:
      "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    priceCents: 79999,
    categoryId: "home-living",
    brand: "VisionPro",
    description:
      "Transform your home entertainment with our Ultra HD Smart TV featuring vibrant colors, immersive sound, and smart connectivity.",
  },
];

async function seed() {
  console.log(
    "Seeding products… (run seed-categories.ts first to create categories)",
  );
  for (const p of DEMO_PRODUCTS) {
    await db
      .insert(productsTable)
      .values({
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
      })
      .onConflictDoNothing({ target: productsTable.id });
  }

  console.log("Linking products to categories…");
  for (const p of DEMO_PRODUCTS) {
    await db
      .insert(productCategoriesTable)
      .values({
        productId: p.id,
        categoryId: p.categoryId,
        isMain: true,
      })
      .onConflictDoNothing({
        target: [
          productCategoriesTable.productId,
          productCategoriesTable.categoryId,
        ],
      });
  }

  console.log(
    "Done. Demo products are in the database. Reviews are production data only.",
  );
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
