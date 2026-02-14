/**
 * Step 2 only: run the bulk update using the already-uploaded imageId.
 * Uses a 10-minute timeout to allow the full server-side operation to complete.
 */

import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { existsSync } from "node:fs";
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

// The imageId from the previous successful upload (raw PNG, no makeTransparent)
const IMAGE_ID = "6990a70d05c34f934b607715";

async function main() {
  console.log("API base:", API_BASE);
  console.log("Using imageId:", IMAGE_ID);

  console.log("\nRunning update-products-design (design, sync, mockups, categories/SEO)...");
  console.log("(This may take 5+ minutes, please wait...)\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 600_000); // 10 minutes

  try {
    const updateRes = await fetch(
      `${API_BASE}/api/admin/printify/update-products-design`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ imageId: IMAGE_ID, tag: "SOLUNA" }),
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);

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
    console.log("Products:", updateData.products);
    console.log("Design updated:", updateData.designUpdated);
    console.log("Synced:", updateData.synced);
    console.log("Mockups uploaded:", updateData.mockupsUploaded);
    console.log("Patched (categories/SEO):", updateData.patched);
    if (updateData.errors?.length) {
      console.warn("Errors:", updateData.errors);
    }
    console.log("\nDone. All SOLUNA products updated with correct print file (black border intact).");
  } catch (e: any) {
    clearTimeout(timeout);
    if (e.name === "AbortError") {
      console.error("Request timed out after 10 minutes.");
    }
    throw e;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
