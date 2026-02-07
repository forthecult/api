/**
 * Uploads brand logos and assets from scripts/brand-assets/<slug>/ to UploadThing,
 * then updates brand.logoUrl and brand_asset rows.
 *
 * Requires: UPLOADTHING_TOKEN in .env (same as the app).
 * Run after seeding brands: bun run db:upload-brand-assets
 * Use --force to re-upload for brands that already have a logo.
 *
 * Run: bun run db:upload-brand-assets [--force]
 */

import "dotenv/config";

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { UTApi } from "uploadthing/server";

import { db } from "../src/db";
import { brandAssetTable, brandTable } from "../src/db/schema";
import { getUploadThingToken, validateUploadThingToken } from "../src/lib/uploadthing-token";

const ASSETS_DIR = join(process.cwd(), "scripts", "brand-assets");
const ALLOWED_EXT = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function assetType(filename: string): "logo" | "banner" | "other" {
  const lower = filename.toLowerCase();
  if (lower.startsWith("logo.")) return "logo";
  if (lower.startsWith("banner.")) return "banner";
  return "other";
}

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

async function main() {
  const force = process.argv.includes("--force");

  const token = getUploadThingToken();
  if (!token) {
    const msg =
      "UPLOADTHING_TOKEN not set. Add it in .env (local) or in GitHub Settings → Secrets (UPLOADTHING_TOKEN) for staging seed. Use the raw token with no quotes.";
    if (process.env.GITHUB_ACTIONS === "true") {
      console.error(msg);
      process.exit(1);
    }
    console.log(msg + " Skipping brand asset upload.");
    process.exit(0);
  }

  if (!validateUploadThingToken(token)) {
    const msg =
      "UPLOADTHING_TOKEN is set but invalid. It must be a base64-encoded JSON object with apiKey, appId, and regions (from UploadThing Dashboard → API Keys → V7). Do not use an old secret or a plain API key. Skipping brand asset upload.";
    console.warn(msg);
    process.exit(process.env.GITHUB_ACTIONS === "true" ? 0 : 1);
  }

  if (!existsSync(ASSETS_DIR)) {
    console.log("No scripts/brand-assets directory found. Create it and add brand slug folders with logo.* / banner.* images.");
    process.exit(0);
  }

  const brands = await db.select({ id: brandTable.id, slug: brandTable.slug, logoUrl: brandTable.logoUrl }).from(brandTable);
  const brandsWithAssets = brands.filter((b) => existsSync(join(ASSETS_DIR, b.slug)));
  if (brandsWithAssets.length === 0) {
    console.log("No brand-assets folders match seeded brand slugs. Add e.g. scripts/brand-assets/<slug>/logo.png for brands you want logos uploaded.");
    process.exit(0);
  }
  console.log(`Found ${brandsWithAssets.length} brand(s) with assets to upload (${brandsWithAssets.map((b) => b.slug).join(", ")})`);

  const utapi = new UTApi({ token });
  let uploaded = 0;

  for (const brand of brands) {
    const slugDir = join(ASSETS_DIR, brand.slug);
    if (!existsSync(slugDir)) continue;

    if (!force && brand.logoUrl) {
      console.log(`Skip (has logo): ${brand.slug}`);
      continue;
    }

    const entries = readdirSync(slugDir, { withFileTypes: true })
      .filter((e) => e.isFile() && ALLOWED_EXT.includes(ext(e.name)))
      .map((e) => ({ name: e.name, type: assetType(e.name) }))
      .sort((a, b) => {
        const order = { logo: 0, banner: 1, other: 2 };
        return order[a.type] - order[b.type];
      });

    if (entries.length === 0) {
      console.log(`Skip (no images): ${brand.slug}`);
      continue;
    }

    let firstLogoUrl: string | null = null;

    for (const { name, type } of entries) {
      const path = join(slugDir, name);
      const buf = readFileSync(path);
      const mime = MIME[ext(name)] ?? "image/png";
      const file = new File([buf], name, { type: mime });

      const result = await utapi.uploadFiles(file);
      const data = Array.isArray(result) ? result[0] : result;

      if (!data || typeof data !== "object") {
        console.error(`Upload failed for ${brand.slug}/${name}`);
        continue;
      }

      const res = data as { url?: string; ufsUrl?: string; data?: { url?: string; ufsUrl?: string }; error?: { code?: string; message?: string } };
      if (res.error) {
        const code = res.error?.code;
        const message = res.error?.message ?? String(res.error);
        if (code === "INVALID_SERVER_CONFIG" || message.includes("Invalid token")) {
          console.warn(
            "UPLOADTHING_TOKEN is invalid. It must be a base64-encoded JSON object with apiKey, appId, and regions from UploadThing Dashboard → API Keys → V7. Update the token in .env or in GitHub Settings → Secrets (UPLOADTHING_TOKEN). Skipping remaining uploads.",
          );
          process.exit(process.env.GITHUB_ACTIONS === "true" ? 0 : 1);
        }
        console.error(`Upload error for ${brand.slug}/${name}:`, res.error);
        continue;
      }

      const url = res.url ?? res.ufsUrl ?? res.data?.url ?? res.data?.ufsUrl ?? null;
      if (!url) {
        console.error(`No URL in response for ${brand.slug}/${name}`);
        continue;
      }

      if (type === "logo" && !firstLogoUrl) firstLogoUrl = url;

      await db.insert(brandAssetTable).values({
        id: createId(),
        brandId: brand.id,
        url,
        type,
        sortOrder: type === "logo" ? 0 : type === "banner" ? 1 : 2,
      });
      console.log(`  Uploaded ${name} → ${type} (${brand.slug})`);
      uploaded++;
    }

    if (firstLogoUrl) {
      await db.update(brandTable).set({ logoUrl: firstLogoUrl, updatedAt: new Date() }).where(eq(brandTable.id, brand.id));
      console.log(`  Set logoUrl for ${brand.slug}`);
    }
  }

  console.log(`Done. Uploaded ${uploaded} asset(s).`);
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
