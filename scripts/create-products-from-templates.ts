/**
 * Create products in the "For the Cult" Printful store from product templates.
 * Uses template titles (Honey and Silk copy) and upgrades them for Culture store branding and SEO.
 *
 * Run from repo root:
 *   bun run scripts/create-products-from-templates.ts [target_store_id]
 *   # or: PRINTFUL_TARGET_STORE_ID=17668650 bun run scripts/create-products-from-templates.ts
 *
 * Requires: PRINTFUL_API_TOKEN (account-level with product_templates/read and sync_products).
 * Target store defaults to 17668650 (For the Cult) if not passed.
 */

import "dotenv/config";

import {
  createSyncProduct,
  fetchProductTemplates,
  type PrintfulProductTemplateItem,
} from "../src/lib/printful";

const DEFAULT_TARGET_STORE_ID = 17668650;

function getTargetStoreId(): number {
  const fromArg = process.argv[2];
  if (fromArg) {
    const n = parseInt(fromArg, 10);
    if (!Number.isNaN(n)) return n;
  }
  const id = process.env.PRINTFUL_TARGET_STORE_ID?.trim();
  if (id) {
    const n = parseInt(id, 10);
    if (!Number.isNaN(n)) return n;
  }
  return DEFAULT_TARGET_STORE_ID;
}

/** Upgrade title from Honey and Silk style to Culture branding + SEO (~60 chars for meta). */
function upgradeTitleForCulture(title: string): string {
  const t = title.trim();
  if (!t) return t;
  const titleCased = t
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  if (titleCased.length <= 60) return titleCased;
  return titleCased.slice(0, 57) + "...";
}

/** Build SEO-friendly product description from title (for store/Printful). */
function buildDescriptionForCulture(title: string): string {
  return `${title}. Premium quality, made to order. Multiple sizes and colors available.`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function buildSyncVariantsFromTemplate(tpl: PrintfulProductTemplateItem): Array<{
  variant_id: number;
  retail_price?: string;
  files: Array<{ type: string; url: string; options?: Array<{ id: string; value: string | boolean }> }>;
  options?: Array<{ id: string; value: string }>;
}> {
  const placement = tpl.placements?.[0]?.placement ?? "front";
  const fileUrl = tpl.mockup_file_url;
  if (!fileUrl) {
    throw new Error(`Template ${tpl.id} has no mockup_file_url`);
  }

  const variantOptions =
    tpl.option_data?.map((o) => ({
      id: o.id,
      value: Array.isArray(o.value) ? o.value[0] ?? "" : o.value,
    })) ?? undefined;

  return tpl.available_variant_ids.map((variant_id) => ({
    variant_id,
    files: [{ type: placement, url: fileUrl }],
    ...(variantOptions?.length ? { options: variantOptions } : {}),
  }));
}

async function main() {
  const targetStoreId = getTargetStoreId();
  console.log(`Target store: ${targetStoreId} (For the Cult)\n`);

  const allTemplates: PrintfulProductTemplateItem[] = [];
  let offset = 0;
  const limit = 100;

  do {
    const res = await fetchProductTemplates({ offset, limit });
    allTemplates.push(...(res.items ?? []));
    if ((res.items?.length ?? 0) < limit) break;
    offset += limit;
    if (res.paging && offset >= res.paging.total) break;
  } while (true);

  console.log(`Found ${allTemplates.length} product template(s). Creating products with Culture branding...\n`);

  const rateLimitMs = 6_000;
  let created = 0;
  const suggestedSeo: Array<{ templateId: number; title: string; metaDescription: string; pageTitle: string }> = [];

  for (let i = 0; i < allTemplates.length; i++) {
    const tpl = allTemplates[i]!;
    const honeyTitle = tpl.title?.trim() || `Product ${tpl.id}`;
    const cultureTitle = upgradeTitleForCulture(honeyTitle);
    const description = buildDescriptionForCulture(cultureTitle);
    const thumbnail = tpl.mockup_file_url;

    let sync_variants: ReturnType<typeof buildSyncVariantsFromTemplate>;
    try {
      sync_variants = buildSyncVariantsFromTemplate(tpl);
    } catch (e) {
      console.error(`  [${i + 1}/${allTemplates.length}] Skip template ${tpl.id}: ${(e as Error).message}`);
      continue;
    }

    if (sync_variants.length === 0) {
      console.log(`  [${i + 1}/${allTemplates.length}] Skip template ${tpl.id} (no variants)`);
      continue;
    }

    try {
      await createSyncProduct(
        {
          sync_product: {
            name: cultureTitle,
            ...(thumbnail ? { thumbnail } : {}),
          },
          sync_variants,
        },
        targetStoreId,
      );
      created++;
      const metaDesc =
        description.length <= 155 ? description : description.slice(0, 152) + "...";
      suggestedSeo.push({
        templateId: tpl.id,
        title: cultureTitle,
        metaDescription: metaDesc,
        pageTitle: `${cultureTitle} | Culture`,
      });
      console.log(`  [${i + 1}/${allTemplates.length}] Created: "${cultureTitle}"`);
    } catch (e) {
      console.error(`  [${i + 1}/${allTemplates.length}] Create failed for template ${tpl.id}: ${(e as Error).message}`);
    }

    if (i < allTemplates.length - 1) {
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
