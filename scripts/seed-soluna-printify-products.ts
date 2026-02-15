/**
 * Create 6 Printify products with the SOLUNA logo via admin API.
 * Exact PumpFun Printify lineup (no coffee): shot glass, ping pong paddle, sticker, phone case, wireless charger, poker playing cards. No t-shirt/hoodie (Printful).
 * Uses SOLUNA category + Solana; sets features and SEO on each product.
 * Use transparent-background PNG; run scripts/fix-soluna-printify-products.ts to fix existing products.
 *
 * Usage:
 *   cd ftc
 *   ADMIN_API_KEY=<key> bun run scripts/seed-soluna-printify-products.ts
 * Or with custom base URL:
 *   NEXT_PUBLIC_APP_URL=https://your-store.com ADMIN_API_KEY=<key> bun run scripts/seed-soluna-printify-products.ts
 *
 * Prerequisites: PRINTIFY_API_TOKEN, PRINTIFY_SHOP_ID. For production use Cursor Secrets
 * (ADMIN_AI_API_KEY) or create ftc/.env.local with ADMIN_AI_API_KEY=<production key>.
 */

import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local so production key from Cursor Secrets (or local override) is available
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

const SOLUNA_IMAGE_PATH =
  process.env.SOLUNA_IMAGE_PATH?.trim() ||
  resolve(
    process.cwd(),
    "assets/soluna_300dpi-b2ae2c87-5ed6-46dd-8481-adb428fad8a5.png",
  );

// 6 product types: exact PumpFun Printify lineup (no coffee, no hoodie/tshirt — those are Printful).
const PRODUCT_SEARCHES: { search: string; productLabel: string }[] = [
  { search: "shot glass", productLabel: "Shot Glass" },
  { search: "ping pong", productLabel: "Ping Pong Paddle" },
  { search: "sticker", productLabel: "Sticker" },
  { search: "phone case", productLabel: "Phone Case" },
  { search: "wireless charger", productLabel: "Wireless Charger" },
  { search: "poker playing cards", productLabel: "Poker Playing Cards" },
];

const SOLUNA_CATEGORY_ID = "soluna";
const SOLANA_CATEGORY_ID = "solana";

const BASE_TITLE = "SOLUNA";
const BASE_DESCRIPTION = `Official SOLUNA merchandise. SOLUNA is the beloved meme of Solana—vibrant, community-driven, and here to stay. Show your support with premium apparel and gear. Pay with SOL, USDC, or card. Culture.`;
const TAGS = ["SOLUNA", "Solana meme", "Solana", "crypto merch", "blockchain"];

function buildProductTitle(productLabel: string): string {
  return `${BASE_TITLE} ${productLabel}`;
}

function buildFeatures(productLabel: string): string[] {
  return [
    `Official SOLUNA (Solana meme) ${productLabel.toLowerCase()} design`,
    "Vibrant gradient SOLUNA logo — teal, fuchsia, purple",
    "Premium quality; made to order",
    "Pay with SOL, USDC, or card",
  ];
}

function buildSeo(productLabel: string): {
  pageTitle: string;
  metaDescription: string;
} {
  const title = buildProductTitle(productLabel);
  return {
    pageTitle: `${title} — Solana Meme Merch | Culture`,
    metaDescription: `${title}. SOLUNA is the meme of Solana. Premium quality, vibrant design. Pay with SOL, USDC, or card. Culture.`,
  };
}

async function ensureSolunaCategory(): Promise<string> {
  // Check if SOLUNA category exists (GET categories and find by slug/name)
  const listRes = await fetch(`${API_BASE}/api/admin/categories?limit=500`, {
    headers,
  });
  if (!listRes.ok) {
    throw new Error(`Categories list failed: ${listRes.status}`);
  }
  const listData = (await listRes.json()) as {
    items?: Array<{ id: string; name: string; slug?: string }>;
  };
  const categories = listData.items ?? [];
  const existing = categories.find(
    (c) => c.slug === "soluna" || c.name.toLowerCase() === "soluna",
  );
  if (existing) {
    console.log("SOLUNA category already exists:", existing.id);
    return existing.id;
  }

  const createRes = await fetch(`${API_BASE}/api/admin/categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "SOLUNA",
      slug: "soluna",
      title: "SOLUNA Merchandise — Solana Meme Apparel & Gear | Culture",
      metaDescription:
        "SOLUNA (Solana meme) merchandise: apparel, hoodies, shot glasses, and gear. Premium quality. Pay with SOL, USDC, or card. Culture.",
      description:
        "SOLUNA is the meme of Solana—community-driven and here to stay. Premium SOLUNA merchandise: tees, hoodies, shot glasses, posters, and more. Pay with SOL, USDC, or card. Culture.",
      level: 2,
      parentId: "network-artificial-organism",
      visible: true,
      featured: false,
    }),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(
      `Create SOLUNA category failed: ${createRes.status} ${text}`,
    );
  }
  const created = (await createRes.json()) as { id: string; name: string };
  console.log("Created SOLUNA category:", created.id);
  return created.id;
}

async function uploadImage(): Promise<{ imageId: string; imageUrl: string }> {
  const buffer = readFileSync(SOLUNA_IMAGE_PATH);
  const formData = new FormData();
  const file = new File([buffer], "soluna-logo.png", { type: "image/png" });
  formData.append("file", file);

  const res = await fetch(
    `${API_BASE}/api/admin/pod/upload?provider=printify`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}` },
      body: formData,
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { imageId?: string; imageUrl?: string };
  if (!data.imageId) throw new Error("Upload response missing imageId");
  const imageUrl =
    data.imageUrl ?? `https://api.printify.com/uploads/${data.imageId}`;
  console.log("Uploaded image to Printify, imageId:", data.imageId);
  return { imageId: data.imageId, imageUrl };
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
  const catalog = (await catalogRes.json()) as Array<{
    id: string;
    title: string;
  }>;
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
  if (!res.ok) throw new Error(`Blueprint detail failed: ${res.status}`);
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
  const priceCents = Math.max(999, Math.round(avgCost));
  const markup = Math.round(priceCents * 0.4);
  const sellPrice = Math.max(100, priceCents + markup);

  const body = {
    provider: "printify",
    blueprintId,
    printProviderId,
    title,
    description: BASE_DESCRIPTION,
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
  if (result.success === false && result.errors?.length) {
    console.warn("  Create response errors:", result.errors.join("; "));
  }
  const printifyId = result.externalProductId ?? result.printifyProductId ?? "";
  return {
    localProductId: result.localProductId,
    printifyProductId: printifyId,
    externalProductId: printifyId,
  };
}

async function patchProductSeoAndFeatures(
  productId: string,
  productLabel: string,
  categoryId: string,
): Promise<void> {
  const features = buildFeatures(productLabel);
  const seo = buildSeo(productLabel);

  const res = await fetch(`${API_BASE}/api/admin/products/${productId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      features,
      pageTitle: seo.pageTitle,
      metaDescription: seo.metaDescription,
      seoOptimized: true,
      mainCategoryId: categoryId,
      categoryIds: [categoryId, SOLANA_CATEGORY_ID].filter(Boolean),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH product failed: ${res.status} ${text}`);
  }
  console.log("  Updated features + SEO for", productId);
}

async function main() {
  console.log("API base:", API_BASE);
  console.log("SOLUNA image path:", SOLUNA_IMAGE_PATH);

  const categoryId = await ensureSolunaCategory();
  const { imageId, imageUrl } = await uploadImage();

  const created: Array<{
    productLabel: string;
    localProductId?: string;
    printifyProductId?: string;
  }> = [];
  for (const { search, productLabel } of PRODUCT_SEARCHES) {
    console.log(
      "\nResolving blueprint for:",
      productLabel,
      `(search: ${search})`,
    );
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
    console.log("  Variants:", variants.length);

    const result = await createProduct({
      imageId,
      imageUrl,
      blueprintId: bp.blueprintId,
      printProviderId: bp.printProviderId,
      productLabel,
      variants,
    });
    const printifyId =
      result.externalProductId ?? result.printifyProductId ?? "";
    created.push({
      productLabel,
      localProductId: result.localProductId,
      printifyProductId: printifyId,
    });
    console.log(
      "  Created Printify product:",
      printifyId || "(no id in response)",
      "Local:",
      result.localProductId ?? "—",
    );

    let localId = result.localProductId;
    if (!localId && printifyId) {
      const syncRes = await fetch(`${API_BASE}/api/admin/printify/sync`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "import_single",
          printifyProductId: printifyId,
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
        await patchProductSeoAndFeatures(localId, productLabel, categoryId);
      } catch (patchErr) {
        console.warn(
          "  PATCH features/SEO failed (product created in Printify):",
          patchErr instanceof Error ? patchErr.message : patchErr,
        );
      }
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  console.log("\nDone. Created", created.length, "SOLUNA products.");
  created.forEach((c) =>
    console.log(
      " -",
      c.productLabel,
      c.printifyProductId
        ? `Printify ID: ${c.printifyProductId}`
        : "(no Printify ID)",
      c.localProductId ? `| local: ${c.localProductId}` : "",
    ),
  );
  console.log(
    "\nIf you don't see these in Printify, confirm the shop at forthecult.store uses the same PRINTIFY_SHOP_ID as the account you're viewing.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
