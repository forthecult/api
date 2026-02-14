/**
 * Update all SOLUNA Printify products with a new print file (transparent background)
 * and refresh mockups to UploadThing.
 *
 * 1. Create transparent-background PNG from the source image and upload to Printify.
 * 2. Update every SOLUNA Printify product's design with the new image.
 * 3. Trigger publish so Printify regenerates mockups.
 * 4. Re-sync each product from Printify so local DB gets new image URLs.
 * 5. Re-host mockup images to UploadThing for each product.
 *
 * Run: cd relivator && bun run scripts/update-soluna-printfile-and-mockups.ts
 *
 * Requires:
 * - .env.local (or .env): ADMIN_AI_API_KEY, NEXT_PUBLIC_APP_URL (or MAIN_APP_URL)
 * - UPLOADTHING_TOKEN (for step 5; can be in .env on the server if using API)
 * - SOLUNA_PRINTFILE_PATH: path to the PNG print file (default: relivator/assets/soluna_300dpi-e1244a91-efae-41ba-baae-84bd1ef9fd9f.png)
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

const SOLUNA_PRINTFILE_PATH =
  process.env.SOLUNA_PRINTFILE_PATH?.trim() ||
  resolve(
    process.cwd(),
    "assets/soluna_300dpi-e1244a91-efae-41ba-baae-84bd1ef9fd9f.png",
  );

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

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

async function uploadImage(buffer: Buffer): Promise<{
  imageId: string;
  imageUrl: string;
}> {
  const formData = new FormData();
  const file = new File([buffer], "soluna-transparent.png", {
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
  const data = (await res.json()) as { imageId?: string; imageUrl?: string };
  if (!data.imageId) throw new Error("Upload response missing imageId");
  return {
    imageId: data.imageId,
    imageUrl:
      data.imageUrl ?? `https://api.printify.com/uploads/${data.imageId}`,
  };
}

async function updateDesign(
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
  console.log("  Updated design:", printifyProductId);
}

async function syncProduct(printifyProductId: string): Promise<void> {
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
    throw new Error(`Sync failed: ${res.status} ${text}`);
  }
  console.log("  Synced:", printifyProductId);
}

async function uploadMockupsToUploadThing(productId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/admin/products/${productId}/upload-mockups`,
    {
      method: "POST",
      headers,
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload mockups failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as {
    success?: boolean;
    message?: string;
    uploaded?: number;
  };
  console.log(
    "  UploadThing:",
    data.uploaded ?? 0,
    "image(s) —",
    data.message ?? "ok",
  );
}

async function getSolunaPrintifyProducts(): Promise<
  { id: string; printifyProductId: string; name: string }[]
> {
  const res = await fetch(`${API_BASE}/api/admin/products/soluna-printify`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`List SOLUNA products failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as {
    products: { id: string; printifyProductId: string; name: string }[];
  };
  return data.products ?? [];
}

async function main() {
  console.log("API base:", API_BASE);
  console.log("Print file:", SOLUNA_PRINTFILE_PATH);

  if (!existsSync(SOLUNA_PRINTFILE_PATH)) {
    console.error(
      "Print file not found. Set SOLUNA_PRINTFILE_PATH or place the PNG at:",
      SOLUNA_PRINTFILE_PATH,
    );
    process.exit(1);
  }

  const products = await getSolunaPrintifyProducts();
  if (products.length === 0) {
    console.error(
      "No SOLUNA Printify products found (tag SOLUNA + source printify).",
    );
    process.exit(1);
  }
  console.log("\nSOLUNA Printify products:", products.length);
  products.forEach((p) => console.log("  -", p.name, "|", p.printifyProductId));

  console.log("\n1. Creating transparent-background image...");
  const transparentBuffer = await makeTransparentPng(SOLUNA_PRINTFILE_PATH);
  const outPath = resolve(process.cwd(), "assets/soluna-transparent.png");
  writeFileSync(outPath, transparentBuffer);
  console.log("   Saved:", outPath);

  console.log("\n2. Uploading transparent image to Printify...");
  const { imageId } = await uploadImage(transparentBuffer);
  console.log("   imageId:", imageId);

  console.log("\n3. Updating all SOLUNA products with new design + publish...");
  for (const p of products) {
    try {
      await updateDesign(p.printifyProductId, imageId);
    } catch (e) {
      console.warn("   Skip update", p.printifyProductId, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  const MOCKUP_WAIT_MS = 120_000;
  console.log(
    `\n4. Waiting ${MOCKUP_WAIT_MS / 1000}s for Printify to regenerate mockups...`,
  );
  await new Promise((r) => setTimeout(r, MOCKUP_WAIT_MS));

  console.log("\n5. Re-syncing each product from Printify (refresh image URLs)...");
  for (const p of products) {
    try {
      await syncProduct(p.printifyProductId);
    } catch (e) {
      console.warn("   Skip sync", p.printifyProductId, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\n6. Uploading mockups to UploadThing...");
  for (const p of products) {
    try {
      await uploadMockupsToUploadThing(p.id);
    } catch (e) {
      console.warn(
        "   Skip upload-mockups",
        p.id,
        (e as Error).message,
      );
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(
    "\nDone. All SOLUNA products updated with new print file (transparent) and mockups re-hosted to UploadThing.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
