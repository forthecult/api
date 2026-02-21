/**
 * Fix Crustafarian Printify products. Only uses these 5 designs:
 *   - crustafarian (transparent logo) → use transparent image only; set product "Background color" to Black in Printify.
 *   - crustafarian_shrimp-of-revelation, etc. → full-bleed (coverCanvas).
 * 1. Use CRUSTAFARIAN_TRANSPARENT_IMAGE_ID (transparent design already in Printify) or upload from local.
 * 2. Update design with that image only (no extra background layer). Sync Printify -> store; PATCH.
 * Set each product's "Background color" to Black in Printify editor so the product surface is black.
 *
 * Env: CRUSTAFARIAN_TRANSPARENT_IMAGE_ID = Printify image ID of your uploaded transparent crustafarian image.
 *
 * Run: cd webapp && NEXT_PUBLIC_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> \
 *   CRUSTAFARIAN_TRANSPARENT_IMAGE_ID=<id> bun run scripts/fix-crustafarian-printify-products.ts
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

/** Use your already-uploaded Printify transparent image so we don't re-upload. Set and run the script to apply that design. */
const CRUSTAFARIAN_TRANSPARENT_IMAGE_ID =
  process.env.CRUSTAFARIAN_TRANSPARENT_IMAGE_ID?.trim() || null;

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

const CRUSTAFARIANISM_BASE = resolve(
  process.cwd(),
  "public/crypto/crustafarianism",
);
const CRUSTAFARIAN_MAIN_IMAGE = resolve(
  CRUSTAFARIANISM_BASE,
  "crust-logo.png",
);
const DESIGN_DIR = resolve(CRUSTAFARIANISM_BASE, "design");
const DESIGN_ART_DIR = resolve(CRUSTAFARIANISM_BASE, "design art");

/** Only these 5 Crustafarian designs are used. First = transparent logo (black bg on product). Rest = full artworks (cover canvas). */
const CRUSTAFARIAN_DESIGN_KEYS = [
  "crustafarian",
  "crustafarian_shrimp-of-revelation",
  "crustafarian_shell-is-immutable",
  "crustafarian_creation-of-the-claw",
  "crustafarian_creation",
] as const;
const TRANSPARENT_DESIGN_KEY = "crustafarian";

/** Product types that get the transparent logo (black bg + small logo). Everything else gets full-bleed artwork. */
const PRODUCTS_USE_TRANSPARENT_LOGO = new Set(
  [
    "mouse-pad",
    "coaster",
    "sticker",
    "keychain",
    "mug",
    "tumbler",
    "phone-case",
    "laptop-sleeve",
    "pillow",
    "notebook",
    "spiral-notebook",
    "pen",
    "tote-bag",
    "apron",
    "water-bottle",
    "wireless-charger",
    "playing-cards",
    "shot-glass",
    "greeting-card",
    "floor-mat",
    "ping-pong-paddle",
  ].map((s) => s.toLowerCase()),
);

function resolveDesignPath(key: string): string | null {
  for (const dir of [DESIGN_ART_DIR, DESIGN_DIR, CRUSTAFARIANISM_BASE]) {
    if (!existsSync(dir)) continue;
    for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
      const p = resolve(dir, `${key}${ext}`);
      if (existsSync(p)) return p;
    }
  }
  if (key === TRANSPARENT_DESIGN_KEY && existsSync(CRUSTAFARIAN_MAIN_IMAGE))
    return CRUSTAFARIAN_MAIN_IMAGE;
  return null;
}

/** Pick one of the 5 designs for this product type. Transparent logo for small/merch; full artwork for display/large. */
function designKeyForProduct(productLabel: string): (typeof CRUSTAFARIAN_DESIGN_KEYS)[number] {
  const base = productLabel
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  if (PRODUCTS_USE_TRANSPARENT_LOGO.has(base)) return TRANSPARENT_DESIGN_KEY;
  const fullArtKeys = CRUSTAFARIAN_DESIGN_KEYS.filter((k) => k !== TRANSPARENT_DESIGN_KEY);
  const idx = base.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return fullArtKeys[idx % fullArtKeys.length];
}

function designFileForProduct(productLabel: string): {
  path: string;
  key: (typeof CRUSTAFARIAN_DESIGN_KEYS)[number];
  coverCanvas: boolean;
} {
  const key = designKeyForProduct(productLabel);
  const path = resolveDesignPath(key);
  if (!path) {
    if (key === TRANSPARENT_DESIGN_KEY && CRUSTAFARIAN_TRANSPARENT_IMAGE_ID)
      return { path: CRUSTAFARIAN_MAIN_IMAGE, key, coverCanvas: false };
    const fallback = existsSync(CRUSTAFARIAN_MAIN_IMAGE)
      ? CRUSTAFARIAN_MAIN_IMAGE
      : resolve(CRUSTAFARIANISM_BASE, "crustafarian.png");
    if (!existsSync(fallback))
      throw new Error(`No design file for key "${key}" and no fallback. Only use the 5 Crustafarian designs.`);
    return {
      path: fallback,
      key: TRANSPARENT_DESIGN_KEY,
      coverCanvas: false,
    };
  }
  const coverCanvas = key !== TRANSPARENT_DESIGN_KEY;
  return { path, key, coverCanvas };
}

import {
  buildProductDescription,
  getFeaturesForProduct,
} from "./crustafarian-product-content";

/** Infer product type from name, e.g. "Crustafarian Mug" -> "Mug" */
function productLabelFromName(name: string): string {
  const prefix = "Crustafarian ";
  if (name.startsWith(prefix)) return name.slice(prefix.length).trim();
  return name.replace(/^Crustafarian\s+/i, "").trim() || name;
}

async function getCrustafarianProducts(): Promise<
  { id: string; name: string; printifyProductId: string }[]
> {
  const res = await fetch(
    `${API_BASE}/api/admin/products/crustafarian-printify`,
    { headers },
  );
  if (res.ok) {
    const data = (await res.json()) as {
      products?: Array<{ id: string; name: string; printifyProductId: string }>;
    };
    const list = data.products ?? [];
    if (list.length > 0) return list;
  }

  const out: { id: string; name: string; printifyProductId: string }[] = [];
  let page = 1;
  const limit = 100;
  while (true) {
    const listRes = await fetch(
      `${API_BASE}/api/admin/products?search=${encodeURIComponent("Crustafarian")}&limit=${limit}&page=${page}`,
      { headers },
    );
    if (!listRes.ok) break;
    const listData = (await listRes.json()) as {
      items?: Array<{ id: string; name: string; printifyProductId?: string | null }>;
    };
    const items = listData.items ?? [];
    for (const p of items) {
      let pid = p.printifyProductId;
      if (!pid) {
        const getRes = await fetch(`${API_BASE}/api/admin/products/${p.id}`, {
          headers,
        });
        if (getRes.ok) {
          const full = (await getRes.json()) as { printifyProductId?: string | null };
          pid = full.printifyProductId ?? null;
        }
      }
      if (pid)
        out.push({ id: p.id, name: p.name, printifyProductId: pid });
    }
    if (items.length < limit) break;
    page++;
  }
  return out;
}

async function uploadImage(
  imagePath: string,
  useTransparentBackground: boolean,
): Promise<string> {
  if (!existsSync(imagePath)) {
    throw new Error(`Design file not found: ${imagePath}`);
  }
  const buffer = readFileSync(imagePath);
  const formData = new FormData();
  const ext = imagePath.endsWith(".png")
    ? "png"
    : imagePath.endsWith(".webp")
      ? "webp"
      : "jpg";
  const file = new File([buffer], `crustafarian.${ext}`, {
    type:
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg",
  });
  formData.append("file", file);

  const q = new URLSearchParams({ provider: "printify" });
  if (useTransparentBackground) q.set("makeTransparent", "true");
  const res = await fetch(
    `${API_BASE}/api/admin/pod/upload?${q.toString()}`,
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
  const data = (await res.json()) as { imageId?: string };
  if (!data.imageId) throw new Error("Upload response missing imageId");
  return data.imageId;
}

async function updatePrintifyDesign(
  printifyProductId: string,
  imageId: string,
  coverCanvas: boolean,
  enableBlackBackgroundOnly: boolean,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/admin/printify/products/${printifyProductId}/update-design`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        imageId,
        coverCanvas,
        enableBlackBackgroundOnly,
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update design failed: ${res.status} ${text}`);
  }
}

async function syncPrintifyToStore(printifyProductId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/printify/sync`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "import_single",
      printifyProductId,
      overwrite: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sync Printify -> store failed: ${res.status} ${text}`);
  }
}

async function patchProduct(
  productId: string,
  productLabel: string,
  description: string,
  features: string[],
): Promise<void> {
  const title = `Crustafarian ${productLabel}`;
  const res = await fetch(`${API_BASE}/api/admin/products/${productId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      description,
      features,
      pageTitle: `${title} — Church of Molt Merch | Culture`,
      metaDescription: `${title}. Crustafarianism, Church of Molt, CRUST. Premium quality. Culture.`,
      seoOptimized: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH product failed: ${res.status} ${text}`);
  }
}

async function main() {
  console.log("API base:", API_BASE);
  if (CRUSTAFARIAN_TRANSPARENT_IMAGE_ID)
    console.log("Using pre-uploaded transparent image ID:", CRUSTAFARIAN_TRANSPARENT_IMAGE_ID);

  if (!CRUSTAFARIAN_TRANSPARENT_IMAGE_ID && !existsSync(CRUSTAFARIAN_MAIN_IMAGE)) {
    console.error(
      "Main image not found: public/crypto/crustafarianism/crust-logo.png. Or set CRUSTAFARIAN_TRANSPARENT_IMAGE_ID to your Printify image ID (transparent crustafarian image).",
    );
    process.exit(1);
  }

  const products = await getCrustafarianProducts();
  console.log("Found", products.length, "Crustafarian Printify products.");
  if (products.length === 0) {
    console.error(
      "No Crustafarian Printify products found (name contains 'Crustafarian', source=printify).",
    );
    process.exit(1);
  }

  let updated = 0;
  let errors = 0;

  for (const p of products) {
    const productLabel = productLabelFromName(p.name);
    const { path: designPath, key: designKey, coverCanvas } = designFileForProduct(productLabel);
    const designSource =
      designPath === CRUSTAFARIAN_MAIN_IMAGE
        ? "crust-logo.png"
        : designPath.replace(process.cwd(), "");
    const useTransparent = designKey === TRANSPARENT_DESIGN_KEY;

    console.log(
      "\n",
      p.name,
      "| label:",
      productLabel,
      "| design:",
      designKey,
      useTransparent ? "(transparent + black bg)" : "(full-bleed + black bg)",
    );

    try {
      const imageId =
        useTransparent && CRUSTAFARIAN_TRANSPARENT_IMAGE_ID
          ? CRUSTAFARIAN_TRANSPARENT_IMAGE_ID
          : await uploadImage(designPath, useTransparent);
      await updatePrintifyDesign(
        p.printifyProductId,
        imageId,
        coverCanvas,
        true,
      );
      await syncPrintifyToStore(p.printifyProductId);

      const description = buildProductDescription(productLabel);
      const features = getFeaturesForProduct(productLabel);
      await patchProduct(p.id, productLabel, description, features);

      updated++;
      console.log("  Updated design, synced Printify -> store, PATCHed copy.");
    } catch (e) {
      errors++;
      console.error(
        "  Error:",
        e instanceof Error ? e.message : String(e),
      );
    }

    await new Promise((r) => setTimeout(r, 600));
  }

  console.log("\nDone. Updated:", updated, "Errors:", errors);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
