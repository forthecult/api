/**
 * Seeds shipping options by brand:
 * - PacSafe: US free over $49, US $8.99 under $49
 * - All other brands: US $3, International $8
 *
 * Run: bun run db:seed-shipping-by-brand
 *
 * Options (env):
 *   DRY_RUN=1  - Log what would be created, do not insert.
 */

import "dotenv/config";

import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

import { db } from "../src/db";
import { brandTable, shippingOptionsTable } from "../src/db/schema";

const DRY_RUN = process.env.DRY_RUN === "1";

const PACSAFE_NAME_PATTERN = "pacsafe"; // match PacSafe, pacsafe, etc.

async function main() {
  console.log(DRY_RUN ? "[DRY RUN] No rows will be inserted.\n" : "");

  const brands = await db.select({ id: brandTable.id, name: brandTable.name }).from(brandTable);

  if (brands.length === 0) {
    console.log("No brands found. Run db:seed-brands first if needed.");
    return;
  }

  const now = new Date();

  for (const brand of brands) {
    const isPacSafe =
      typeof brand.name === "string" &&
      brand.name.trim().toLowerCase().includes(PACSAFE_NAME_PATTERN);

    // Remove existing shipping options for this brand so we replace with fixed rules
    if (!DRY_RUN) {
      await db.delete(shippingOptionsTable).where(eq(shippingOptionsTable.brandId, brand.id));
    } else {
      console.log(`[${brand.name}] Would delete existing shipping options.`);
    }

    if (isPacSafe) {
      // PacSafe: US free over $49, US $8.99 under $49
      const options = [
        {
          id: createId(),
          name: "PacSafe US Free over $49",
          countryCode: "US",
          minOrderCents: 4900,
          maxOrderCents: null,
          type: "free" as const,
          amountCents: null,
          priority: 1,
        },
        {
          id: createId(),
          name: "PacSafe US Under $49",
          countryCode: "US",
          minOrderCents: null,
          maxOrderCents: 4899,
          type: "flat" as const,
          amountCents: 899,
          priority: 0,
        },
      ];
      for (const opt of options) {
        const row = {
          id: opt.id,
          name: opt.name,
          countryCode: opt.countryCode,
          minOrderCents: opt.minOrderCents,
          maxOrderCents: opt.maxOrderCents,
          minQuantity: null,
          maxQuantity: null,
          minWeightGrams: null,
          maxWeightGrams: null,
          type: opt.type,
          amountCents: opt.amountCents,
          priority: opt.priority,
          brandId: brand.id,
          sourceUrl: null,
          estimatedDaysText: null,
          createdAt: now,
          updatedAt: now,
        };
        if (DRY_RUN) {
          console.log(`  Would create: ${row.name} (${opt.type}${opt.amountCents != null ? ` $${(opt.amountCents / 100).toFixed(2)}` : ""})`);
        } else {
          await db.insert(shippingOptionsTable).values(row);
          console.log(`  Created: ${row.name}`);
        }
      }
    } else {
      // Other brands: US $3, International $8 (countryCode null = worldwide)
      const options = [
        {
          id: createId(),
          name: `${brand.name} US`,
          countryCode: "US",
          type: "flat" as const,
          amountCents: 300,
          priority: 1,
        },
        {
          id: createId(),
          name: `${brand.name} International`,
          countryCode: null,
          type: "flat" as const,
          amountCents: 800,
          priority: 0,
        },
      ];
      for (const opt of options) {
        const row = {
          id: opt.id,
          name: opt.name,
          countryCode: opt.countryCode,
          minOrderCents: null,
          maxOrderCents: null,
          minQuantity: null,
          maxQuantity: null,
          minWeightGrams: null,
          maxWeightGrams: null,
          type: opt.type,
          amountCents: opt.amountCents,
          priority: opt.priority,
          brandId: brand.id,
          sourceUrl: null,
          estimatedDaysText: null,
          createdAt: now,
          updatedAt: now,
        };
        if (DRY_RUN) {
          console.log(`  Would create: ${row.name} $${(opt.amountCents / 100).toFixed(2)}`);
        } else {
          await db.insert(shippingOptionsTable).values(row);
          console.log(`  Created: ${row.name}`);
        }
      }
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
