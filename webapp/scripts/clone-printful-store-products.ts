/**
 * Clone in-stock sync products from Printful store 13844209 to a new store.
 * Recreates products with SEO-improved titles and outputs suggested descriptions/meta for your DB.
 *
 * Run from repo root:
 *   bun run scripts/clone-printful-store-products.ts <target_store_id>
 *   # or: PRINTFUL_TARGET_STORE_ID=12345 bun run scripts/clone-printful-store-products.ts
 *
 * List your stores (to find the new store ID):
 *   bun run scripts/clone-printful-store-products.ts --list-stores
 *
 * Requires: PRINTFUL_API_TOKEN. Target store: CLI arg, or PRINTFUL_TARGET_STORE_ID in env.
 */

import "dotenv/config";

import {
  createSyncProduct,
  fetchStores,
  fetchSyncProduct,
  fetchSyncProducts,
  type PrintfulSyncProductFull,
  type PrintfulSyncVariant,
} from "../src/lib/printful";

const SOURCE_STORE_ID = 13844209;

function getTargetStoreId(): number {
  const fromArg = process.argv[2];
  if (fromArg && fromArg !== "--list-stores") {
    const n = parseInt(fromArg, 10);
    if (!Number.isNaN(n)) return n;
  }
  const id = process.env.PRINTFUL_TARGET_STORE_ID?.trim();
  if (!id) {
    throw new Error(
      "Target store ID required. Pass it as first argument (e.g. bun run scripts/clone-printful-store-products.ts 12345) or set PRINTFUL_TARGET_STORE_ID. Use --list-stores to see store IDs.",
    );
  }
  const n = parseInt(id, 10);
  if (Number.isNaN(n))
    throw new Error("PRINTFUL_TARGET_STORE_ID must be a number");
  return n;
}

/** Improve product name for SEO: title case, trim, keep under ~60 chars for meta. */
function improveTitleForSeo(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  const titleCased = trimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  if (titleCased.length <= 60) return titleCased;
  return `${titleCased.slice(0, 57)}...`;
}

/** Suggested meta description (for your DB) – keep under ~155 chars. */
function suggestedMetaDescription(
  title: string,
  _variantCount: number,
): string {
  const base = `${title}. Premium quality, multiple sizes and colors.`;
  if (base.length <= 155) return base;
  return `${base.slice(0, 152)}...`;
}

/** Suggested page title for SEO (for your DB). */
function suggestedPageTitle(title: string): string {
  return `${title} | Culture`;
}

function isInStock(v: PrintfulSyncVariant): boolean {
  const status = v.availability_status;
  if (!status) return true;
  return status !== "discontinued" && status !== "out_of_stock";
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (process.argv.includes("--list-stores")) {
    const stores = await fetchStores();
    console.log("Your Printful stores (use ID as target for clone):\n");
    for (const s of stores) {
      console.log(
        `  ID: ${s.id}  Name: ${s.name ?? "(no name)"}  Type: ${s.type ?? ""}`,
      );
    }
    console.log(
      `\nSource for clone is store ${SOURCE_STORE_ID}. Use another store's ID as target.`,
    );
    return;
  }

  const targetStoreId = getTargetStoreId();
  console.log(`Source store: ${SOURCE_STORE_ID}`);
  console.log(`Target store: ${targetStoreId}\n`);

  const allProducts: { id: number; name: string }[] = [];
  let offset = 0;
  const limit = 100;

  do {
    const { products, paging } = await fetchSyncProducts(
      { status: "synced", offset, limit },
      SOURCE_STORE_ID,
    );
    allProducts.push(...products.map((p) => ({ id: p.id, name: p.name })));
    if (products.length < limit) break;
    offset += limit;
    if (offset >= paging.total) break;
  } while (true);

  console.log(
    `Found ${allProducts.length} synced products. Cloning in-stock only...\n`,
  );

  const rateLimitMs = 6_000;
  let created = 0;
  const suggestedSeo: Array<{
    sourceId: number;
    newTitle: string;
    metaDescription: string;
    pageTitle: string;
  }> = [];

  for (let i = 0; i < allProducts.length; i++) {
    const { id: sourceId, name: sourceName } = allProducts[i]!;
    let full: PrintfulSyncProductFull;
    try {
      full = await fetchSyncProduct(sourceId, SOURCE_STORE_ID);
    } catch (e) {
      console.error(
        `  [${i + 1}/${allProducts.length}] Skip product ${sourceId}: ${(e as Error).message}`,
      );
      continue;
    }

    const inStockVariants = full.sync_variants.filter(isInStock);
    if (inStockVariants.length === 0) {
      console.log(
        `  [${i + 1}/${allProducts.length}] Skip ${sourceId} (no in-stock variants)`,
      );
      continue;
    }

    const newTitle = improveTitleForSeo(full.sync_product.name);
    const thumbnail =
      full.sync_product.thumbnail_url ||
      inStockVariants[0]?.product?.image ||
      undefined;

    const sync_variants = inStockVariants.map((v) => {
      const files = (v.files ?? [])
        .filter((f) => f.url)
        .map((f) => ({
          type: f.type || "default",
          url: f.url!,
          ...(f.options?.length ? { options: f.options } : undefined),
        }));

      return {
        variant_id: v.variant_id,
        retail_price: v.retail_price ?? undefined,
        files,
        options: (v.options ?? []).map((o) => ({
          id: o.id,
          value: o.value as string | string[],
        })),
      };
    });

    try {
      await createSyncProduct(
        {
          sync_product: {
            name: newTitle,
            ...(thumbnail ? { thumbnail } : {}),
          },
          sync_variants,
        },
        targetStoreId,
      );
      created++;
      suggestedSeo.push({
        sourceId,
        newTitle,
        metaDescription: suggestedMetaDescription(
          newTitle,
          inStockVariants.length,
        ),
        pageTitle: suggestedPageTitle(newTitle),
      });
      console.log(`  [${i + 1}/${allProducts.length}] Created: "${newTitle}"`);
    } catch (e) {
      console.error(
        `  [${i + 1}/${allProducts.length}] Create failed for ${sourceId}: ${(e as Error).message}`,
      );
    }

    if (i < allProducts.length - 1) {
      await sleep(rateLimitMs);
    }
  }

  console.log(`\nDone. Created ${created} products in store ${targetStoreId}.`);
  if (suggestedSeo.length > 0) {
    console.log("\n--- Suggested SEO (for your DB) ---");
    console.log(JSON.stringify(suggestedSeo, null, 2));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
