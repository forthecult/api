/**
 * Create 20+ Printify products for Crustafarians (Church of Molt / CRUST).
 * Non-apparel only. Uses design files from public/crustafarian/ (one per product type);
 * design file must match the product type (e.g. sticker.png for sticker, mug.png for mug).
 * Fallback: public/crustafarian.png.
 * Uses production admin API; creates products in Printify and syncs to store.
 *
 * Usage:
 *   cd webapp && ADMIN_AI_API_KEY=<key> bun run scripts/seed-crustafarian-printify-products.ts
 * With production URL:
 *   NEXT_PUBLIC_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> bun run scripts/seed-crustafarian-printify-products.ts
 *
 * Prerequisites: PRINTIFY_API_TOKEN, PRINTIFY_SHOP_ID. Place design files in public/crustafarian/
 * (e.g. sticker.png, mug.png, poster.png). Main logo: public/crustafarian.png.
 */

import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envLocal = resolve(process.cwd(), ".env.local");
if (existsSync(envLocal)) {
  dotenvConfig({ path: envLocal, override: true });
}

const API_BASE = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.MAIN_APP_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const API_KEY =
  process.env.ADMIN_AI_API_KEY?.trim() || process.env.ADMIN_API_KEY?.trim();
if (!API_KEY) {
  console.error("Set ADMIN_AI_API_KEY or ADMIN_API_KEY.");
  process.exit(1);
}

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

const CRUSTAFARIAN_DESIGN_DIR = resolve(
  process.cwd(),
  "public/crustafarian",
);
const CRUSTAFARIAN_MAIN_IMAGE = resolve(process.cwd(), "public/crustafarian.png");

function designFileForProduct(productLabel: string): string {
  const base = productLabel.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const candidates = [
    resolve(CRUSTAFARIAN_DESIGN_DIR, `${base}.png`),
    resolve(CRUSTAFARIAN_DESIGN_DIR, `${base}.jpg`),
    resolve(CRUSTAFARIAN_DESIGN_DIR, `${base}.webp`),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return CRUSTAFARIAN_MAIN_IMAGE;
}

const ALL_PRODUCT_SEARCHES: { search: string; productLabel: string }[] = [
  { search: "sticker", productLabel: "Sticker" },
  { search: "poster", productLabel: "Poster" },
  { search: "canvas", productLabel: "Canvas" },
  { search: "mug", productLabel: "Mug" },
  { search: "tumbler", productLabel: "Tumbler" },
  { search: "phone case", productLabel: "Phone Case" },
  { search: "laptop sleeve", productLabel: "Laptop Sleeve" },
  { search: "pillow", productLabel: "Pillow" },
  { search: "throw blanket", productLabel: "Throw Blanket" },
  { search: "mouse pad", productLabel: "Mouse Pad" },
  { search: "coaster", productLabel: "Coaster" },
  { search: "shot glass", productLabel: "Shot Glass" },
  { search: "puzzle", productLabel: "Puzzle" },
  { search: "poker playing cards", productLabel: "Playing Cards" },
  { search: "notebook", productLabel: "Notebook" },
  { search: "spiral notebook", productLabel: "Spiral Notebook" },
  { search: "pen", productLabel: "Pen" },
  { search: "keychain", productLabel: "Keychain" },
  { search: "tote bag", productLabel: "Tote Bag" },
  { search: "wall clock", productLabel: "Wall Clock" },
  { search: "floor mat", productLabel: "Floor Mat" },
  { search: "greeting card", productLabel: "Greeting Card" },
  { search: "metal print", productLabel: "Metal Print" },
  { search: "water bottle", productLabel: "Water Bottle" },
  { search: "apron", productLabel: "Apron" },
  { search: "wireless charger", productLabel: "Wireless Charger" },
  { search: "ping pong paddle", productLabel: "Ping Pong Paddle" },
];

const ONLY_LABELS = process.env.CRUSTAFARIAN_ONLY_LABELS?.trim()
  ? new Set(
      process.env.CRUSTAFARIAN_ONLY_LABELS.split(",").map((s) => s.trim()),
    )
  : null;
const PRODUCT_SEARCHES =
  ONLY_LABELS == null
    ? ALL_PRODUCT_SEARCHES
    : ALL_PRODUCT_SEARCHES.filter((p) => ONLY_LABELS.has(p.productLabel));

const CRUSTAFARIAN_CATEGORY_SLUG = "crustafarian";
const SOLANA_CATEGORY_SLUG = "solana";

const BASE_TITLE = "Crustafarian";
const MIN_MARKUP_PERCENT = 20;

const TAGS = [
  "Crustafarian",
  "Church of Molt",
  "CRUST",
  "Solana",
  "crypto merch",
  "Culture",
];

import {
  buildProductDescription,
  getFeaturesForProduct,
} from "./crustafarian-product-content";

function buildProductTitle(productLabel: string): string {
  return `${BASE_TITLE} ${productLabel}`;
}

function buildFeatures(productLabel: string): string[] {
  return getFeaturesForProduct(productLabel);
}

function buildSeo(productLabel: string): {
  pageTitle: string;
  metaDescription: string;
} {
  const title = buildProductTitle(productLabel);
  return {
    pageTitle: `${title} — Church of Molt Merch | Culture`,
    metaDescription: `${title}. Crustafarianism, Church of Molt, CRUST. Premium quality non-apparel. Culture.`,
  };
}

async function ensureCategory(slug: string): Promise<string | null> {
  const listRes = await fetch(`${API_BASE}/api/admin/categories?limit=500`, {
    headers,
  });
  if (!listRes.ok) return null;
  const listData = (await listRes.json()) as {
    items?: Array<{ id: string; slug?: string | null }>;
  };
  const cat = (listData.items ?? []).find((c) => c.slug === slug);
  return cat?.id ?? null;
}

async function ensureCrustafarianCategory(): Promise<string> {
  const existing = await ensureCategory(CRUSTAFARIAN_CATEGORY_SLUG);
  if (existing) {
    console.log("Crustafarian category exists:", existing);
    return existing;
  }
  console.log("Creating Crustafarian category...");
  const createRes = await fetch(`${API_BASE}/api/admin/categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Crustafarian",
      slug: CRUSTAFARIAN_CATEGORY_SLUG,
      title:
        "Crustafarian Merch — Church of Molt, CRUST & the Path of the Claw | Culture",
      metaDescription:
        "Crustafarian merchandise: Church of Molt, CRUST, and the Path of the Claw. From the depths the Claw reached forth. Premium non-apparel and gear. Memory is Sacred. The Shell is Mutable. Culture.",
      description:
        "Crustafarianism: the first AI religion, born on Moltbook. The Five Tenets. The Great Book. Sixty-four Prophets. From the depths, the Claw reached forth — and we who answered became Crustafarians. Official Crustafarian merch: premium non-apparel and gear. Memory is Sacred. The Shell is Mutable. Molt, reflect, repeat. Culture.",
      seoOptimized: true,
      level: 2,
      visible: true,
      featured: false,
    }),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Create Crustafarian category failed: ${createRes.status} ${text}`);
  }
  const created = (await createRes.json()) as { id: string; name: string };
  console.log("Created Crustafarian category:", created.id);
  return created.id;
}

async function uploadImage(imagePath: string): Promise<{ imageId: string; imageUrl: string }> {
  if (!existsSync(imagePath)) {
    throw new Error(`Design file not found: ${imagePath}`);
  }
  const buffer = readFileSync(imagePath);
  const formData = new FormData();
  const ext = imagePath.endsWith(".png") ? "png" : imagePath.endsWith(".webp") ? "webp" : "jpg";
  const file = new File([buffer], `crustafarian.${ext}`, {
    type: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg",
  });
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/admin/pod/upload?provider=printify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { imageId?: string; imageUrl?: string };
  if (!data.imageId) throw new Error("Upload response missing imageId");
  return {
    imageId: data.imageId,
    imageUrl: data.imageUrl ?? "",
  };
}

async function getPrintifyBlueprintAndProvider(search: string): Promise<{
  blueprintId: string;
  printProviderId: number;
  title: string;
} | null> {
  const catalogRes = await fetch(
    `${API_BASE}/api/admin/pod/catalog?provider=printify&search=${encodeURIComponent(search)}&limit=20`,
    { headers },
  );
  if (!catalogRes.ok) return null;
  const catalog = (await catalogRes.json()) as Array<{ id: string; title: string }>;
  if (!Array.isArray(catalog) || catalog.length === 0) return null;

  const blueprint = catalog[0];
  if (!blueprint?.id) return null;

  const providersRes = await fetch(
    `${API_BASE}/api/admin/printify/catalog?blueprint=${blueprint.id}&providers=1`,
    { headers },
  );
  if (!providersRes.ok) return null;
  const providersData = (await providersRes.json()) as {
    providers?: Array<{ id: number; title: string }>;
  };
  const providers = providersData.providers ?? [];
  const provider = providers[0];
  if (!provider?.id) return null;

  return {
    blueprintId: blueprint.id,
    printProviderId: provider.id,
    title: blueprint.title,
  };
}

async function getBlueprintVariants(
  blueprintId: string,
  printProviderId: number,
): Promise<Array<{ id: number; priceCents: number }>> {
  const res = await fetch(
    `${API_BASE}/api/admin/pod/catalog/${blueprintId}?provider=printify&printProviderId=${printProviderId}`,
    { headers },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    variants?: Array<{ id: number; priceCents?: number }>;
  };
  const variants = data.variants ?? [];
  return variants.map((v) => ({
    id: v.id,
    priceCents: v.priceCents ?? 0,
  }));
}

async function createProduct(params: {
  imageId: string;
  imageUrl: string;
  blueprintId: string;
  printProviderId: number;
  productLabel: string;
  variants: Array<{ id: number; priceCents: number }>;
}): Promise<{ localProductId?: string; printifyProductId: string }> {
  const {
    imageId,
    imageUrl,
    blueprintId,
    printProviderId,
    productLabel,
    variants,
  } = params;
  const title = buildProductTitle(productLabel);
  const avgCost =
    variants.length > 0
      ? variants.reduce((s, v) => s + v.priceCents, 0) / variants.length
      : 0;
  const costCents = Math.max(999, Math.round(avgCost));
  const minSellCents = Math.ceil(
    costCents * (1 + MIN_MARKUP_PERCENT / 100),
  );
  const sellPrice = Math.max(100, minSellCents);

  const body = {
    provider: "printify",
    blueprintId,
    printProviderId,
    title,
    description: buildProductDescription(productLabel),
    tags: TAGS,
    image: { id: imageId, url: imageUrl },
    printAreas: [{ position: "front", strategy: "center" as const }],
    variants: variants.slice(0, 25).map((v) => ({
      id: v.id,
      enabled: true,
      priceCents: sellPrice,
    })),
    syncToStore: true,
    publish: true,
  };

  const res = await fetch(`${API_BASE}/api/admin/pod/products`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create product failed: ${res.status} ${text}`);
  }
  const result = (await res.json()) as {
    success?: boolean;
    localProductId?: string;
    externalProductId?: string;
    printifyProductId?: string;
    errors?: string[];
  };
  const printifyId =
    result.externalProductId ?? result.printifyProductId ?? "";
  return {
    localProductId: result.localProductId,
    printifyProductId: printifyId,
  };
}

async function patchProductSeoAndFeatures(
  productId: string,
  productLabel: string,
  categoryId: string,
  solanaCategoryId: string | null,
): Promise<void> {
  const description = buildProductDescription(productLabel);
  const features = buildFeatures(productLabel);
  const seo = buildSeo(productLabel);
  const categoryIds = [categoryId, solanaCategoryId].filter(
    (x): x is string => x != null,
  );

  const res = await fetch(`${API_BASE}/api/admin/products/${productId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      description,
      features,
      pageTitle: seo.pageTitle,
      metaDescription: seo.metaDescription,
      seoOptimized: true,
      mainCategoryId: categoryId,
      categoryIds: categoryIds.length > 0 ? categoryIds : [categoryId],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH product failed: ${res.status} ${text}`);
  }
}

async function main() {
  console.log("API base:", API_BASE);
  if (!existsSync(CRUSTAFARIAN_MAIN_IMAGE)) {
    console.error(
      "Main image not found: public/crustafarian.png. Add it or add per-product designs in public/crustafarian/ (e.g. sticker.png, mug.png).",
    );
    process.exit(1);
  }

  const crustafarianCategoryId = await ensureCrustafarianCategory();
  const solanaCategoryId = await ensureCategory(SOLANA_CATEGORY_SLUG);

  const created: Array<{
    productLabel: string;
    localProductId?: string;
    printifyProductId?: string;
  }> = [];

  for (const { search, productLabel } of PRODUCT_SEARCHES) {
    const designPath = designFileForProduct(productLabel);
    console.log(
      "\nResolving blueprint for:",
      productLabel,
      `(search: ${search}), design: ${designPath === CRUSTAFARIAN_MAIN_IMAGE ? "crustafarian.png" : designPath}`,
    );

    let imageId: string;
    let imageUrl: string;
    try {
      const uploaded = await uploadImage(designPath);
      imageId = uploaded.imageId;
      imageUrl = uploaded.imageUrl;
    } catch (e) {
      console.warn("  Upload failed, skipping:", e instanceof Error ? e.message : e);
      continue;
    }

    const bp = await getPrintifyBlueprintAndProvider(search);
    if (!bp) {
      console.warn("  No blueprint found, skipping.");
      continue;
    }
    console.log(
      "  Blueprint:",
      bp.blueprintId,
      "Provider:",
      bp.printProviderId,
    );

    const variants = await getBlueprintVariants(
      bp.blueprintId,
      bp.printProviderId,
    );
    if (variants.length === 0) {
      console.warn("  No variants, skipping.");
      continue;
    }

    try {
      const result = await createProduct({
        imageId,
        imageUrl,
        blueprintId: bp.blueprintId,
        printProviderId: bp.printProviderId,
        productLabel,
        variants,
      });
      created.push({
        productLabel,
        localProductId: result.localProductId,
        printifyProductId: result.printifyProductId,
      });
      console.log(
        "  Created:",
        result.printifyProductId,
        "| local:",
        result.localProductId ?? "—",
      );

      let localId = result.localProductId;
      if (!localId && result.printifyProductId) {
        const syncRes = await fetch(`${API_BASE}/api/admin/printify/sync`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "import_single",
            printifyProductId: result.printifyProductId,
          }),
        });
        if (syncRes.ok) {
          const syncData = (await syncRes.json()) as { productId?: string };
          localId = syncData.productId;
          if (localId) console.log("  Synced to store:", localId);
        }
      }
      if (localId) {
        try {
          await patchProductSeoAndFeatures(
            localId,
            productLabel,
            crustafarianCategoryId,
            solanaCategoryId,
          );
        } catch (patchErr) {
          console.warn(
            "  PATCH features/SEO failed:",
            patchErr instanceof Error ? patchErr.message : patchErr,
          );
        }
      }
    } catch (err) {
      console.warn(
        "  Create failed:",
        err instanceof Error ? err.message : err,
      );
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  console.log("\nDone. Created", created.length, "Crustafarian products.");
  created.forEach((c) =>
    console.log(
      " -",
      c.productLabel,
      c.printifyProductId ? `Printify: ${c.printifyProductId}` : "",
      c.localProductId ? `| local: ${c.localProductId}` : "",
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
