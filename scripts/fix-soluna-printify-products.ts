/**
 * Fix SOLUNA Printify products:
 * 1. Create transparent-background version of SOLUNA logo and upload to Printify.
 * 2. Delete wrong products: Poster, Throw Pillow, Tote Bag, T-Shirt, duplicate Shot Glass.
 * 3. Update the 4 correct products (Shot Glass, Ping Pong, Sticker, Phone Case) with transparent design.
 * 4. Create 2 missing products (Wireless Charger, Poker Cards) with transparent design.
 * 5. Trigger publish so mockups regenerate.
 *
 * Run: cd relivator && bun run scripts/fix-soluna-printify-products.ts
 * Requires .env.local with ADMIN_AI_API_KEY and NEXT_PUBLIC_APP_URL (or MAIN_APP_URL).
 */

import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
// @ts-expect-error sharp types
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

const SOLUNA_IMAGE_PATH =
  process.env.SOLUNA_IMAGE_PATH?.trim() ||
  resolve(process.cwd(), "assets/soluna_300dpi-b2ae2c87-5ed6-46dd-8481-adb428fad8a5.png");

// Printify product IDs from the creation run
const PRINTIFY_IDS = {
  shotGlass: "699091bba604252cfe0b9eb2",
  shotGlassDuplicate: "6990905e5f277c55ae0b2860",
  pingPong: "699091c380720a653b049192",
  tShirt: "699091d0bca977ae630b79aa",
  poster: "6990922690577c34b0047ea3",
  sticker: "6990923f5f277c55ae0b28d7",
  toteBag: "69909247c14beb0d76010104",
  throwPillow: "6990924fc14beb0d76010107",
  phoneCase: "69909258c14beb0d7601010a",
} as const;

const KEEP_AND_UPDATE = [
  PRINTIFY_IDS.shotGlass,
  PRINTIFY_IDS.pingPong,
  PRINTIFY_IDS.sticker,
  PRINTIFY_IDS.phoneCase,
] as const;

const DELETE_IDS = [
  PRINTIFY_IDS.tShirt,
  PRINTIFY_IDS.poster,
  PRINTIFY_IDS.toteBag,
  PRINTIFY_IDS.throwPillow,
  PRINTIFY_IDS.shotGlassDuplicate,
] as const;

async function makeTransparentPng(inputPath: string): Promise<Buffer> {
  const img = sharp(readFileSync(inputPath));
  const { data, info } = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels ?? 4;
  const threshold = 30;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (r <= threshold && g <= threshold && b <= threshold) {
      data[i + 3] = 0;
    }
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

async function uploadImage(buffer: Buffer): Promise<{ imageId: string; imageUrl: string }> {
  const formData = new FormData();
  const file = new File([buffer], "soluna-transparent.png", { type: "image/png" });
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
    imageUrl: data.imageUrl ?? `https://api.printify.com/uploads/${data.imageId}`,
  };
}

async function deleteInPrintify(printifyProductId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/printify/sync`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "delete_in_printify",
      printifyProductId,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Delete failed: ${res.status} ${text}`);
  }
  console.log("  Deleted:", printifyProductId);
}

async function updateDesign(printifyProductId: string, imageId: string): Promise<void> {
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
  console.log("  Updated design:", printifyProductId);
}

async function getBlueprintAndVariants(
  search: string,
): Promise<{
  blueprintId: string;
  printProviderId: number;
  variants: Array<{ id: number; priceCents: number }>;
} | null> {
  const catalogRes = await fetch(
    `${API_BASE}/api/admin/pod/catalog?provider=printify&search=${encodeURIComponent(search)}&limit=10`,
    { headers },
  );
  if (!catalogRes.ok) return null;
  const catalog = (await catalogRes.json()) as Array<{ id: string }>;
  const blueprint = catalog[0];
  if (!blueprint?.id) return null;

  const providersRes = await fetch(
    `${API_BASE}/api/admin/printify/catalog?blueprint=${blueprint.id}&providers=1`,
    { headers },
  );
  if (!providersRes.ok) return null;
  const providersData = (await providersRes.json()) as {
    providers?: Array<{ id: number }>;
  };
  const provider = providersData.providers?.[0];
  if (!provider?.id) return null;

  const detailRes = await fetch(
    `${API_BASE}/api/admin/pod/catalog/${blueprint.id}?provider=printify&printProviderId=${provider.id}`,
    { headers },
  );
  if (!detailRes.ok) return null;
  const detail = (await detailRes.json()) as {
    variants?: Array<{ id: number; priceCents?: number }>;
  };
  const variants = (detail.variants ?? []).map((v) => ({
    id: v.id,
    priceCents: v.priceCents ?? 0,
  }));
  if (variants.length === 0) return null;

  return {
    blueprintId: blueprint.id,
    printProviderId: provider.id,
    variants,
  };
}

const BASE_DESCRIPTION = `Official SOLUNA merchandise. SOLUNA is the beloved meme of Solana—vibrant, community-driven, and here to stay. Show your support with premium apparel and gear. Pay with SOL, USDC, or card. Culture.`;
const TAGS = ["SOLUNA", "Solana meme", "Solana", "crypto merch", "blockchain"];

async function createProduct(
  imageId: string,
  imageUrl: string,
  productLabel: string,
  search: string,
): Promise<string> {
  const bp = await getBlueprintAndVariants(search);
  if (!bp) throw new Error(`No blueprint for: ${search}`);

  const priceCents = Math.max(999, Math.round(
    bp.variants.reduce((s, v) => s + v.priceCents, 0) / bp.variants.length,
  ));
  const sellPrice = Math.max(100, priceCents + Math.round(priceCents * 0.4));

  const res = await fetch(`${API_BASE}/api/admin/pod/products`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      provider: "printify",
      blueprintId: bp.blueprintId,
      printProviderId: bp.printProviderId,
      title: `SOLUNA ${productLabel}`,
      description: BASE_DESCRIPTION,
      tags: TAGS,
      image: { id: imageId, url: imageUrl },
      printAreas: [{ position: "front", strategy: "center" }],
      variants: bp.variants.slice(0, 25).map((v) => ({
        id: v.id,
        enabled: true,
        priceCents: sellPrice,
      })),
      syncToStore: true,
      publish: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create failed: ${res.status} ${text}`);
  }
  const result = (await res.json()) as { externalProductId?: string };
  return result.externalProductId ?? "";
}

async function main() {
  console.log("API base:", API_BASE);
  console.log("Source image:", SOLUNA_IMAGE_PATH);

  console.log("\n1. Creating transparent-background image...");
  const transparentBuffer = await makeTransparentPng(SOLUNA_IMAGE_PATH);
  const outPath = resolve(process.cwd(), "assets/soluna-transparent.png");
  writeFileSync(outPath, transparentBuffer);
  console.log("   Saved:", outPath);

  console.log("\n2. Uploading transparent image to Printify...");
  const { imageId, imageUrl } = await uploadImage(transparentBuffer);
  console.log("   imageId:", imageId);

  console.log("\n3. Deleting wrong/duplicate products...");
  for (const id of DELETE_IDS) {
    try {
      await deleteInPrintify(id);
    } catch (e) {
      console.warn("   Skip delete", id, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\n4. Updating 4 products with transparent design...");
  for (const id of KEEP_AND_UPDATE) {
    try {
      await updateDesign(id, imageId);
    } catch (e) {
      console.warn("   Skip update", id, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log("\n5. Creating Wireless Charger and Poker Cards...");
  const wirelessId = await createProduct(
    imageId,
    imageUrl,
    "Wireless Charger",
    "wireless charger",
  );
  console.log("   Created Wireless Charger:", wirelessId);
  await new Promise((r) => setTimeout(r, 500));

  const pokerId = await createProduct(
    imageId,
    imageUrl,
    "Poker Playing Cards",
    "poker playing cards",
  );
  console.log("   Created Poker Playing Cards:", pokerId);

  console.log("\nDone. SOLUNA Printify lineup: Shot Glass, Ping Pong Paddle, Sticker, Phone Case, Wireless Charger, Poker Cards (6 products, transparent logo).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
