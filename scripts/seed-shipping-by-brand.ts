/**
 * Seeds shipping options by brand from scripts/seed-data/shipping-rules.ts.
 * Used for production/staging so shipping rules are in the DB after seeding.
 * - Brands with an override (e.g. pacsafe) get slug-specific rules.
 * - All other brands get default: US $3, International $8.
 *
 * Run: bun run db:seed-shipping-by-brand
 * (Also run as part of db:seed:staging and db:seed:production.)
 *
 * Options (env):
 *   DRY_RUN=1  - Log what would be created, do not insert.
 */

import "dotenv/config";

import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

import { db } from "../src/db";
import { brandTable, shippingOptionsTable } from "../src/db/schema";
import {
  BRAND_SHIPPING_OVERRIDES,
  DEFAULT_SHIPPING_OPTIONS,
  type ShippingOptionSeed,
} from "./seed-data/shipping-rules";

const DRY_RUN = process.env.DRY_RUN === "1";

function buildRow(
  opt: ShippingOptionSeed,
  brandId: string,
  displayName: string,
  now: Date,
) {
  return {
    id: createId(),
    name: displayName,
    countryCode: opt.countryCode,
    minOrderCents: opt.minOrderCents,
    maxOrderCents: opt.maxOrderCents,
    minQuantity: null,
    maxQuantity: null,
    minWeightGrams: null,
    maxWeightGrams: null,
    type: opt.type,
    amountCents: opt.amountCents,
    additionalItemCents: opt.additionalItemCents ?? null,
    priority: opt.priority,
    brandId,
    sourceUrl: null,
    estimatedDaysText: opt.estimatedDaysText ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

async function main() {
  console.log(DRY_RUN ? "[DRY RUN] No rows will be inserted.\n" : "");

  const brands = await db.select({
    id: brandTable.id,
    name: brandTable.name,
    slug: brandTable.slug,
  }).from(brandTable);

  if (brands.length === 0) {
    console.error("No brands found. Run db:seed-brands first. Failing so CI does not silently skip shipping options.");
    process.exit(1);
  }

  const now = new Date();
  let totalOptions = 0;

  for (const brand of brands) {
    const options: ShippingOptionSeed[] =
      BRAND_SHIPPING_OVERRIDES[brand.slug] ?? DEFAULT_SHIPPING_OPTIONS;

    if (!DRY_RUN) {
      await db.delete(shippingOptionsTable).where(eq(shippingOptionsTable.brandId, brand.id));
    } else {
      console.log(`[${brand.name}] Would delete existing shipping options.`);
    }

    for (const opt of options) {
      const displayName =
        BRAND_SHIPPING_OVERRIDES[brand.slug] != null
          ? opt.name
          : `${brand.name} ${opt.name}`;
      const row = buildRow(opt, brand.id, displayName, now);

      if (DRY_RUN) {
        const amount =
          opt.amountCents != null ? ` $${(opt.amountCents / 100).toFixed(2)}` : "";
        console.log(`  Would create: ${row.name} (${opt.type}${amount})`);
      } else {
        await db.insert(shippingOptionsTable).values(row);
        console.log(`  Created: ${row.name}`);
        totalOptions++;
      }
    }
  }

  console.log(`\nDone. Seeded ${totalOptions} shipping option(s) for ${brands.length} brand(s).`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
