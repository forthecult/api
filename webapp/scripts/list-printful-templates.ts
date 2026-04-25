/**
 * List Printful catalog products (templates) and store sync products.
 * Uses PRINTFUL_API_TOKEN from .env. Run: bun run scripts/list-printful-templates.ts
 */

import "dotenv/config";

import {
  fetchCatalogProducts,
  fetchSyncProducts,
  getPrintfulIfConfigured,
} from "../src/lib/printful";

async function main() {
  const pf = getPrintfulIfConfigured();
  if (!pf) {
    console.error("PRINTFUL_API_TOKEN is not set in .env");
    process.exit(1);
  }

  console.log("Printful API connected.\n");

  // 1) Catalog products (blank templates)
  console.log("--- Catalog products (blank templates) ---");
  try {
    const catalog: Array<{
      id: number;
      name: string;
      type: string;
      variant_count: number;
    }> = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    while (hasMore) {
      const res = await fetchCatalogProducts({ limit, offset });
      catalog.push(
        ...res.data.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type ?? "",
          variant_count: p.variant_count ?? 0,
        })),
      );
      offset += res.data.length;
      hasMore = res.data.length === limit && offset < (res.paging?.total ?? 0);
    }
    const total = catalog.length;
    console.log(`Total: ${total} catalog product(s)\n`);
    catalog.forEach((p) => {
      console.log(
        `  [${p.id}] ${p.name}  (${p.type}, ${p.variant_count} variants)`,
      );
    });
  } catch (err) {
    console.error(
      "Catalog fetch failed:",
      err instanceof Error ? err.message : err,
    );
  }

  // 2) Store sync products (your products with designs)
  console.log("\n--- Store sync products (your products) ---");
  try {
    const store: Array<{
      id: number;
      name: string;
      synced: number;
      variants: number;
    }> = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    while (hasMore) {
      const { products, paging } = await fetchSyncProducts({
        offset,
        limit,
        status: "synced",
      });
      store.push(
        ...products.map((p) => ({
          id: p.id,
          name: p.name,
          synced: p.synced,
          variants: p.variants,
        })),
      );
      offset += products.length;
      hasMore = offset < paging.total;
    }
    console.log(`Total: ${store.length} sync product(s)\n`);
    store.forEach((p) => {
      console.log(`  [${p.id}] ${p.name}  (${p.synced}/${p.variants} synced)`);
    });
  } catch (err) {
    console.error(
      "Store products fetch failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
