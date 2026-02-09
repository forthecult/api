/**
 * Seeds the database with products when DEMO_PRODUCTS or curated products are present (local dev only).
 * Staging/production: no mock products; add real products via admin or Printful/Printify sync.
 * Reviews are seeded separately via seed-reviews.ts (from data/reviews.csv).
 * Run: bun run scripts/seed-products.ts or bun run db:seed-products
 */

import "dotenv/config";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "../src/db";
import {
  productAvailableCountryTable,
  productCategoriesTable,
  productImagesTable,
  productsTable,
  productVariantsTable,
  sizeChartsTable,
} from "../src/db/schema";
import { isUploadThingUrl } from "../src/lib/product-mockup-upload";
import { isShippingExcluded } from "../src/lib/shipping-restrictions";
import { POD_SHIPPING_COUNTRY_CODES } from "../src/lib/pod-shipping-countries";
import { CRYPTOMATIC_JETSETTER } from "./seed-data/cryptomatic-jetsetter";
import { CIRCADIAN_SIZE_CHART, EARTH_RUNNERS_CIRCADIAN } from "./seed-data/earth-runners-circadian";
import { HOME_ASSISTANT_GREEN } from "./seed-data/home-assistant-green";
import { HOME_ASSISTANT_VOICE } from "./seed-data/home-assistant-voice";
import { HUSKYLENS_2 } from "./seed-data/huskylens-2";
import { LINKSTAR_H68K_1432_V2 } from "./seed-data/linkstar-h68k-1432-v2";
import { MINIRIG_4 } from "./seed-data/minirig-4";
import { MINIRIG_SUBWOOFER_4 } from "./seed-data/minirig-subwoofer-4";
import { PACSAFE_EXP_28L } from "./seed-data/pacsafe-exp-28l";
import { PACSAFE_RFIDSAFE_WALLET } from "./seed-data/pacsafe-rfidsafe-wallet";
import { PACSAFE_V_12L } from "./seed-data/pacsafe-v-12l";
import { PACSAFE_V_20L } from "./seed-data/pacsafe-v-20l";
import { SENSECAP_WATCHER_W1_A } from "./seed-data/sensecap-watcher-w1-a";
import { SPOUT_MONOLITH } from "./seed-data/spout-monolith";
import { TREZOR_SAFE_5 } from "./seed-data/trezor-safe-5";
import { TREZOR_SAFE_7 } from "./seed-data/trezor-safe-7";
import { TRMNL_7_5_OG_DIY_KIT } from "./seed-data/trmnl-7-5-og-diy-kit";
import { XIAO_SMART_IR_MATE } from "./seed-data/xiao-smart-ir-mate";

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
  TREZOR_SAFE_7,
  TREZOR_SAFE_5,
  HUSKYLENS_2,
  CRYPTOMATIC_JETSETTER,
  HOME_ASSISTANT_GREEN,
  HOME_ASSISTANT_VOICE,
  LINKSTAR_H68K_1432_V2,
  MINIRIG_4,
  MINIRIG_SUBWOOFER_4,
  SENSECAP_WATCHER_W1_A,
  TRMNL_7_5_OG_DIY_KIT,
  XIAO_SMART_IR_MATE,
];

/** Seeed (and similar) product IDs: always replace images from seed on re-seed so source URLs can be re-uploaded to UploadThing. */
const SEEED_PRODUCT_IDS = new Set([
  SENSECAP_WATCHER_W1_A.id,
  LINKSTAR_H68K_1432_V2.id,
  XIAO_SMART_IR_MATE.id,
  TRMNL_7_5_OG_DIY_KIT.id,
]);

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
    pageLayout: (p as { pageLayout?: string }).pageLayout ?? null,
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

  // Upsert products so re-seed updates optionDefinitionsJson, hasVariants, etc. (fixes Earth Runners Men/Women + Size)
  await db
    .insert(productsTable)
    .values(allProductRows)
    .onConflictDoUpdate({
      target: productsTable.id,
      set: {
        name: sql`excluded.name`,
        slug: sql`excluded.slug`,
        imageUrl: sql`excluded.image_url`,
        mainImageAlt: sql`excluded.main_image_alt`,
        mainImageTitle: sql`excluded.main_image_title`,
        priceCents: sql`excluded.price_cents`,
        compareAtPriceCents: sql`excluded.compare_at_price_cents`,
        costPerItemCents: sql`excluded.cost_per_item_cents`,
        model: sql`excluded.model`,
        description: sql`excluded.description`,
        featuresJson: sql`excluded.features_json`,
        brand: sql`excluded.brand`,
        metaDescription: sql`excluded.meta_description`,
        pageTitle: sql`excluded.page_title`,
        sku: sql`excluded.sku`,
        weightGrams: sql`excluded.weight_grams`,
        weightUnit: sql`excluded.weight_unit`,
        hasVariants: sql`excluded.has_variants`,
        optionDefinitionsJson: sql`excluded.option_definitions_json`,
        pageLayout: sql`excluded.page_layout`,
        handlingDaysMin: sql`excluded.handling_days_min`,
        handlingDaysMax: sql`excluded.handling_days_max`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  // Seed markets (shipping countries) for every curated product: explicit list or full POD list minus exclusions
  const shippingAllowedCountries = POD_SHIPPING_COUNTRY_CODES.filter(
    (c) => !isShippingExcluded(c),
  );
  for (const p of CURATED_PRODUCTS) {
    const explicit = (p as { availableCountryCodes?: readonly string[] }).availableCountryCodes;
    const codes =
      explicit?.length && explicit.length > 0
        ? explicit.filter((c) => !isShippingExcluded(c))
        : shippingAllowedCountries;
    await db
      .delete(productAvailableCountryTable)
      .where(eq(productAvailableCountryTable.productId, p.id));
    if (codes.length > 0) {
      await db.insert(productAvailableCountryTable).values(
        codes.map((countryCode) => ({ productId: p.id, countryCode })),
      );
    }
  }

  const categoryLinks: Array<{ productId: string; categoryId: string }> = [
    ...DEMO_PRODUCTS.map((p) => ({ productId: p.id, categoryId: p.categoryId })),
    ...CURATED_PRODUCTS.map((p) => ({ productId: p.id, categoryId: p.categoryId })),
  ];

  // Pacsafe backpacks must be in Backpacks only (not Bags). Remove any Bags link so re-seed fixes category.
  const pacsafeBackpackIds = [PACSAFE_EXP_28L.id, PACSAFE_V_12L.id, PACSAFE_V_20L.id];
  await db
    .delete(productCategoriesTable)
    .where(
      and(
        inArray(productCategoriesTable.productId, pacsafeBackpackIds),
        eq(productCategoriesTable.categoryId, "accessories-bags"),
      ),
    );

  // Hardware wallets use main category "hardware-wallets". Remove legacy accessories-hardware-wallets link on re-seed.
  const hardwareWalletProductIds = [TREZOR_SAFE_5.id, TREZOR_SAFE_7.id];
  await db
    .delete(productCategoriesTable)
    .where(
      and(
        inArray(productCategoriesTable.productId, hardwareWalletProductIds),
        eq(productCategoriesTable.categoryId, "accessories-hardware-wallets"),
      ),
    );

  // Pacsafe RFIDsafe wallet uses main category Wallets. Remove legacy accessories-travel link on re-seed.
  await db
    .delete(productCategoriesTable)
    .where(
      and(
        eq(productCategoriesTable.productId, PACSAFE_RFIDSAFE_WALLET.id),
        eq(productCategoriesTable.categoryId, "accessories-travel"),
      ),
    );

  // SenseCAP Watcher W1-A and HUSKYLENS 2 use main category AI. Remove legacy category links on re-seed.
  const aiProductIds = [SENSECAP_WATCHER_W1_A.id, HUSKYLENS_2.id];
  await db
    .delete(productCategoriesTable)
    .where(
      and(
        inArray(productCategoriesTable.productId, aiProductIds),
        inArray(productCategoriesTable.categoryId, ["smart-home", "accessories-tech"]),
      ),
    );

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

  // If a curated product already has images on UploadThing, do not overwrite with seed URLs (avoids replacing good images with CDN/thumbnails on re-seed).
  // Exception: Seeed products always get images replaced from seed so we can fix broken/placeholder images and re-upload.
  const existingCurated = await db
    .select({ id: productsTable.id, imageUrl: productsTable.imageUrl })
    .from(productsTable)
    .where(inArray(productsTable.id, CURATED_PRODUCTS.map((x) => x.id)));
  const hasUploadThingImages = new Set(
    existingCurated
      .filter((r) => r.imageUrl && isUploadThingUrl(r.imageUrl))
      .map((r) => r.id),
  );

  for (const p of CURATED_PRODUCTS) {
    const productId = p.id;
    const forceReplaceImages = SEEED_PRODUCT_IDS.has(productId);

    if (p.images?.length && (forceReplaceImages || !hasUploadThingImages.has(productId))) {
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
        gender?: string;
        priceCents: number;
        sku: string;
        imageUrl: string;
        imageAlt?: string;
        imageTitle?: string;
        stockQuantity?: number;
        label?: string;
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
          gender: (v as { gender?: string }).gender ?? null,
          priceCents: v.priceCents,
          sku: v.sku,
          imageUrl: v.imageUrl,
          imageAlt: v.imageAlt ?? null,
          imageTitle: v.imageTitle ?? null,
          stockQuantity: v.stockQuantity ?? null,
          label: (v as { label?: string }).label ?? null,
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
