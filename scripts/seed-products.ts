/**
 * Seeds the database with products when DEMO_PRODUCTS or curated products are present (local dev only).
 * Staging/production: no mock products; add real products via admin or Printful/Printify sync.
 * Reviews are seeded separately via seed-reviews.ts (from data/reviews.csv).
 * Run: bun run scripts/seed-products.ts or bun run db:seed-products
 */

import "dotenv/config";

import { eq } from "drizzle-orm";

import { db } from "../src/db";
import {
  productAvailableCountryTable,
  productCategoriesTable,
  productImagesTable,
  productsTable,
  productVariantsTable,
  sizeChartsTable,
} from "../src/db/schema";
import { CIRCADIAN_SIZE_CHART, EARTH_RUNNERS_CIRCADIAN } from "./seed-data/earth-runners-circadian";
import { PACSAFE_EXP_28L } from "./seed-data/pacsafe-exp-28l";
import { PACSAFE_RFIDSAFE_WALLET } from "./seed-data/pacsafe-rfidsafe-wallet";
import { PACSAFE_V_12L } from "./seed-data/pacsafe-v-12l";
import { PACSAFE_V_20L } from "./seed-data/pacsafe-v-20l";
import { SPOUT_MONOLITH } from "./seed-data/spout-monolith";

const now = new Date();

/**
 * Legacy demo products (minimal shape). Keep empty for staging/production.
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

/** Curated full products (Pacsafe, Spout, etc.) with images, features, and SEO fields. */
const CURATED_PRODUCTS = [
  PACSAFE_EXP_28L,
  PACSAFE_V_20L,
  PACSAFE_V_12L,
  PACSAFE_RFIDSAFE_WALLET,
  EARTH_RUNNERS_CIRCADIAN,
  SPOUT_MONOLITH,
];

async function seed() {
  console.log(
    "Seeding products… (run seed-categories.ts first to create categories)",
  );

  const legacyRows = DEMO_PRODUCTS.map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.imageUrl,
    priceCents: p.priceCents,
    description: p.description,
    brand: p.brand,
    source: "manual" as const,
    published: true,
    handlingDaysMin: null,
    handlingDaysMax: null,
    createdAt: now,
    updatedAt: now,
  }));

  const curatedRows = CURATED_PRODUCTS.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    imageUrl: p.imageUrl,
    mainImageAlt: p.mainImageAlt ?? null,
    mainImageTitle: p.mainImageTitle ?? null,
    priceCents: p.priceCents,
    compareAtPriceCents: (p as { compareAtPriceCents?: number }).compareAtPriceCents ?? null,
    costPerItemCents: (p as { costPerItemCents?: number }).costPerItemCents ?? null,
    model: (p as { model?: string }).model ?? null,
    description: p.description,
    featuresJson:
      (p.features?.length ?? 0) > 0
        ? JSON.stringify(p.features)
        : null,
    brand: p.brand,
    metaDescription: p.metaDescription ?? null,
    pageTitle: p.pageTitle ?? null,
    sku: p.sku ?? null,
    weightGrams: p.weightGrams ?? null,
    weightUnit: p.weightUnit ?? null,
    hasVariants: (p as { hasVariants?: boolean }).hasVariants ?? false,
    optionDefinitionsJson:
      ((p as { optionDefinitions?: Array<{ name: string; values: string[] }> })
        .optionDefinitions?.length ?? 0) > 0
        ? JSON.stringify(
            (p as { optionDefinitions: Array<{ name: string; values: string[] }> })
              .optionDefinitions,
          )
        : null,
    source: "manual" as const,
    published: true,
    handlingDaysMin: (p as { handlingDaysMin?: number }).handlingDaysMin ?? null,
    handlingDaysMax: (p as { handlingDaysMax?: number }).handlingDaysMax ?? null,
    createdAt: now,
    updatedAt: now,
  }));

  const allProductRows = [...legacyRows, ...curatedRows];
  if (allProductRows.length === 0) {
    console.log("No demo or curated products configured. Skipping product seed.");
    return;
  }

  await db
    .insert(productsTable)
    .values(allProductRows)
    .onConflictDoNothing({ target: productsTable.id });

  // Restrict availability by country when product defines availableCountryCodes (e.g. US-only for Spout)
  for (const p of CURATED_PRODUCTS) {
    const codes = (p as { availableCountryCodes?: readonly string[] }).availableCountryCodes;
    if (codes?.length) {
      await db
        .delete(productAvailableCountryTable)
        .where(eq(productAvailableCountryTable.productId, p.id));
      await db.insert(productAvailableCountryTable).values(
        codes.map((countryCode) => ({ productId: p.id, countryCode })),
      );
    }
  }

  const categoryLinks: Array<{ productId: string; categoryId: string }> = [
    ...DEMO_PRODUCTS.map((p) => ({ productId: p.id, categoryId: p.categoryId })),
    ...CURATED_PRODUCTS.map((p) => ({ productId: p.id, categoryId: p.categoryId })),
  ];

  console.log("Linking products to categories…");
  await db
    .insert(productCategoriesTable)
    .values(
      categoryLinks.map((link) => ({
        productId: link.productId,
        categoryId: link.categoryId,
        isMain: true,
      })),
    )
    .onConflictDoNothing({
      target: [
        productCategoriesTable.productId,
        productCategoriesTable.categoryId,
      ],
    });

  // Seed manual size chart for Earth Runners Circadian (Men's & Women's)
  await db
    .insert(sizeChartsTable)
    .values({
      id: CIRCADIAN_SIZE_CHART.id,
      provider: CIRCADIAN_SIZE_CHART.provider,
      brand: CIRCADIAN_SIZE_CHART.brand,
      model: CIRCADIAN_SIZE_CHART.model,
      displayName: CIRCADIAN_SIZE_CHART.displayName,
      dataImperial: CIRCADIAN_SIZE_CHART.dataImperial as unknown as Record<string, unknown>,
      dataMetric: CIRCADIAN_SIZE_CHART.dataMetric as unknown as Record<string, unknown>,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        sizeChartsTable.provider,
        sizeChartsTable.brand,
        sizeChartsTable.model,
      ],
      set: {
        displayName: CIRCADIAN_SIZE_CHART.displayName,
        dataImperial: CIRCADIAN_SIZE_CHART.dataImperial as unknown as Record<string, unknown>,
        dataMetric: CIRCADIAN_SIZE_CHART.dataMetric as unknown as Record<string, unknown>,
        updatedAt: now,
      },
    });

  for (const p of CURATED_PRODUCTS) {
    const productId = p.id;

    if (p.images?.length) {
      await db
        .delete(productImagesTable)
        .where(eq(productImagesTable.productId, productId));
      await db.insert(productImagesTable).values(
        p.images.map((img, i) => ({
          id: `${productId}-img-${i}`,
          productId,
          url: img.url,
          alt: img.alt ?? null,
          title: img.title ?? null,
          sortOrder: i,
        })),
      );
    }

    const variants = (p as {
      variants?: Array<{
        id: string;
        color?: string;
        size?: string;
        priceCents: number;
        sku: string;
        imageUrl: string;
        imageAlt?: string;
        imageTitle?: string;
        stockQuantity?: number;
      }>;
    }).variants;
    if (variants?.length) {
      await db
        .delete(productVariantsTable)
        .where(eq(productVariantsTable.productId, productId));
      await db.insert(productVariantsTable).values(
        variants.map((v) => ({
          id: v.id,
          productId,
          color: v.color ?? null,
          size: v.size ?? null,
          priceCents: v.priceCents,
          sku: v.sku,
          imageUrl: v.imageUrl,
          imageAlt: v.imageAlt ?? null,
          imageTitle: v.imageTitle ?? null,
          stockQuantity: v.stockQuantity ?? null,
          availabilityStatus: (v.stockQuantity ?? 0) > 0 ? "in_stock" : null,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }
  }

  console.log("Done. Products, images, and variants are in the database.");
}

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
