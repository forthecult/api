/**
 * Run SOLUNA update entirely via admin API. Two calls:
 * 1) POST /api/admin/pod/upload?provider=printify&makeTransparent=true (file)
 * 2) POST /api/admin/printify/update-products-design { imageId }
 * All logic (design update, sync, mockups, categories/SEO) runs server-side.
 *
 * Run: cd ftc && bun run scripts/run-soluna-update-via-api.ts
 * Requires .env.local: ADMIN_AI_API_KEY, NEXT_PUBLIC_APP_URL (or MAIN_APP_URL)
 */

import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const envLocal = resolve(process.cwd(), ".env.local");
if (existsSync(envLocal)) {
  dotenvConfig({ path: envLocal, override: true });
}

const API_BASE = (
  process.env.API_BASE ||
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

const PRINT_FILE = resolve(
  process.cwd(),
  "assets/soluna_300dpi-e1244a91-efae-41ba-baae-84bd1ef9fd9f.png",
);

async function main() {
  console.log("API base:", API_BASE);

  if (!existsSync(PRINT_FILE)) {
    console.error("Print file not found:", PRINT_FILE);
    process.exit(1);
  }

  console.log("\n1. Uploading print file (makeTransparent=true)...");
  const formData = new FormData();
  const file = new File(
    [readFileSync(PRINT_FILE)],
    "soluna-print.png",
    { type: "image/png" },
  );
  formData.append("file", file);
  const uploadRes = await fetch(
    `${API_BASE}/api/admin/pod/upload?provider=printify&makeTransparent=true`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}` },
      body: formData,
    },
  );
  if (!uploadRes.ok) {
    const t = await uploadRes.text();
    throw new Error(`Upload failed: ${uploadRes.status} ${t}`);
  }
  const uploadData = (await uploadRes.json()) as { imageId?: string };
  const imageId = uploadData.imageId;
  if (!imageId) throw new Error("Upload response missing imageId");
  console.log("   imageId:", imageId);

  console.log("\n2. Running update-products-design (design, sync, mockups, categories/SEO)...");
  const updateRes = await fetch(
    `${API_BASE}/api/admin/printify/update-products-design`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ imageId, tag: "SOLUNA" }),
    },
  );
  if (!updateRes.ok) {
    const t = await updateRes.text();
    throw new Error(`Update failed: ${updateRes.status} ${t}`);
  }
  const updateData = (await updateRes.json()) as {
    ok?: boolean;
    products?: number;
    designUpdated?: number;
    synced?: number;
    mockupsUploaded?: number;
    patched?: number;
    errors?: string[];
  };
  console.log("   Products:", updateData.products);
  console.log("   Design updated:", updateData.designUpdated);
  console.log("   Synced:", updateData.synced);
  console.log("   Mockups uploaded:", updateData.mockupsUploaded);
  console.log("   Patched (categories/SEO):", updateData.patched);
  if (updateData.errors?.length) {
    console.warn("   Errors:", updateData.errors);
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
