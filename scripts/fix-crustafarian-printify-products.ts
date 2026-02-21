/**
 * Fix Crustafarian Printify products:
 * 1. Use public/crypto/crustafarianism/crust-logo.png and public/crypto/crustafarianism/design (or design art) per product type.
 * 2. Upload the correct image to Printify and update each product's design.
 * 3. Sync Printify -> store so mockups/state are current.
 * 4. PATCH each product with real product features and full descriptions.
 *
 * Run: cd webapp && NEXT_PUBLIC_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> bun run scripts/fix-crustafarian-printify-products.ts
 */

import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import sharp from "sharp";

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

function designFileForProduct(productLabel: string): string {
  const base = productLabel
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  for (const dir of [DESIGN_DIR, DESIGN_ART_DIR]) {
    if (!existsSync(dir)) continue;
    const candidates = [
      resolve(dir, `${base}.png`),
      resolve(dir, `${base}.jpg`),
      resolve(dir, `${base}.webp`),
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
  }
  return CRUSTAFARIAN_MAIN_IMAGE;
}

/** molt.church uses a dark "depths" aesthetic; use black/dark background for print files. */
const CRUSTAFARIAN_BACKGROUND = "#0a0a0a";

/**
 * Prepare image for Printify: composite onto Crustafarian background (black) so transparency
 * and edges look correct on merch. Outputs PNG.
 */
async function prepareImageWithBackground(
  buffer: Buffer,
  backgroundColor: string = CRUSTAFARIAN_BACKGROUND,
): Promise<Buffer> {
  const img = sharp(buffer);
  const meta = await img.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w === 0 || h === 0) return buffer;

  const withAlpha = await img.ensureAlpha().toBuffer();
  const background = sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: backgroundColor,
    },
  })
    .png()
    .toBuffer();

  const composed = await sharp(await background)
    .composite([{ input: withAlpha, top: 0, left: 0 }])
    .png()
    .toBuffer();

  return composed;
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

async function uploadImage(imagePath: string): Promise<string> {
  if (!existsSync(imagePath)) {
    throw new Error(`Design file not found: ${imagePath}`);
  }
  let buffer = readFileSync(imagePath);
  buffer = await prepareImageWithBackground(buffer);
  const formData = new FormData();
  const file = new File([buffer], "crustafarian.png", {
    type: "image/png",
  });
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
  const data = (await res.json()) as { imageId?: string };
  if (!data.imageId) throw new Error("Upload response missing imageId");
  return data.imageId;
}

async function updatePrintifyDesign(
  printifyProductId: string,
  imageId: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/admin/printify/products/${printifyProductId}/update-design`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ imageId }),
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

  if (!existsSync(CRUSTAFARIAN_MAIN_IMAGE)) {
    console.error(
      "Main image not found: public/crypto/crustafarianism/crust-logo.png",
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
    const designPath = designFileForProduct(productLabel);
    const designSource =
      designPath === CRUSTAFARIAN_MAIN_IMAGE
        ? "crust-logo.png"
        : designPath.replace(process.cwd(), "");

    console.log("\n", p.name, "| label:", productLabel, "| design:", designSource);

    try {
      const imageId = await uploadImage(designPath);
      await updatePrintifyDesign(p.printifyProductId, imageId);
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
