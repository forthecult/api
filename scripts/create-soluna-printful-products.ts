/**
 * Create SOLUNA Printful products (white t-shirt + black hoodie).
 *
 * Reads the correct transparent PNG (flood-filled, black border intact)
 * and calls the general-purpose POST /api/admin/printful/create-products
 * endpoint to:
 *   1. Upload the PNG to UploadThing (raw, no WebP conversion)
 *   2. Create Printful sync products with the correct catalog variants
 *   3. Import to local DB
 *   4. Upload mockups to UploadThing
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

const PRINT_FILE = resolve(process.cwd(), "assets/soluna-print-correct.png");

async function main() {
  console.log("API base:", API_BASE);

  if (!existsSync(PRINT_FILE)) {
    console.error("Print file not found:", PRINT_FILE);
    process.exit(1);
  }

  const imageBuffer = readFileSync(PRINT_FILE);
  const imageBase64 = imageBuffer.toString("base64");
  console.log(
    `Print file: ${PRINT_FILE} (${imageBuffer.length} bytes, base64: ${imageBase64.length} chars)`,
  );

  const body = {
    imageBase64,
    imageName: "soluna-print-transparent.png",
    products: [
      {
        catalogProductId: 71, // Bella + Canvas 3001 Unisex Staple T-Shirt
        title: "SOLUNA White T-Shirt",
        description:
          "Premium unisex t-shirt featuring the SOLUNA logo. Bella + Canvas 3001, soft ring-spun cotton, retail fit. Show your support for the Solana ecosystem in style.",
        color: "White",
        sizes: ["S", "M", "L", "XL", "2XL"],
        priceCents: 2999,
        tags: ["SOLUNA"],
        position: "front",
      },
      {
        catalogProductId: 146, // Gildan 18500 Heavy Blend Hoodie
        title: "SOLUNA Black Hoodie",
        description:
          "Cozy unisex hoodie featuring the SOLUNA logo. Gildan 18500 Heavy Blend, soft fleece lining, front pouch pocket. Stay warm and rep the Solana ecosystem.",
        color: "Black",
        sizes: ["S", "M", "L", "XL", "2XL"],
        priceCents: 4999,
        tags: ["SOLUNA"],
        position: "front",
      },
    ],
  };

  console.log("\nCreating SOLUNA Printful products...");
  console.log("  - SOLUNA White T-Shirt (Bella+Canvas 3001)");
  console.log("  - SOLUNA Black Hoodie (Gildan 18500)");
  console.log(
    "(This may take 2-3 minutes for product creation + mockup generation...)\n",
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 600_000); // 10 minutes

  try {
    const res = await fetch(`${API_BASE}/api/admin/printful/create-products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      ok?: boolean;
      imageUrl?: string;
      message?: string;
      results?: Array<{
        success: boolean;
        title: string;
        syncProductId?: number;
        localProductId?: string;
        variantCount?: number;
        error?: string;
      }>;
    };

    console.log("Image URL:", data.imageUrl);
    console.log("Message:", data.message);
    console.log("\nResults:");
    for (const r of data.results ?? []) {
      if (r.success) {
        console.log(
          `  ✓ ${r.title} (syncId: ${r.syncProductId}, localId: ${r.localProductId}, variants: ${r.variantCount})`,
        );
      } else {
        console.log(`  ✗ ${r.title}: ${r.error}`);
      }
    }
    console.log("\nDone.");
  } catch (e: unknown) {
    clearTimeout(timeout);
    if (e instanceof Error && e.name === "AbortError") {
      console.error("Request timed out after 10 minutes.");
    }
    throw e;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
