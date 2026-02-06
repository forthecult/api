/**
 * Uploads lookbook images from public/lookbook/ to UploadThing and writes
 * data/lookbook-images.json with the same metadata and UploadThing URLs.
 * The lookbook page uses that JSON when present so staging/prod can serve
 * images from UploadThing instead of the repo.
 *
 * Requires: UPLOADTHING_TOKEN in .env (raw value, no quotes).
 * Run: bun run scripts/upload-lookbook-to-uploadthing.ts
 * Or add to package.json: "db:upload-lookbook": "bun run scripts/upload-lookbook-to-uploadthing.ts"
 */

import "dotenv/config";

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { UTApi } from "uploadthing/server";

import { LOOKBOOK_IMAGES } from "../src/lib/lookbook-data";

const PUBLIC_LOOKBOOK = join(process.cwd(), "public", "lookbook");
const DATA_DIR = join(process.cwd(), "data");
const OUTPUT_PATH = join(DATA_DIR, "lookbook-images.json");

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

function getToken(): string | undefined {
  const raw = process.env.UPLOADTHING_TOKEN;
  if (raw == null || raw === "") return undefined;
  return raw.trim().replace(/^['"]|['"]$/g, "");
}

async function main() {
  const token = getToken();
  if (!token) {
    console.error(
      "UPLOADTHING_TOKEN not set. Add it in .env (no quotes around the value).",
    );
    process.exit(1);
  }

  if (!existsSync(PUBLIC_LOOKBOOK)) {
    console.error("public/lookbook not found.");
    process.exit(1);
  }

  const utapi = new UTApi({ token });
  const result: typeof LOOKBOOK_IMAGES = [];

  for (const meta of LOOKBOOK_IMAGES) {
    const basename = meta.src.replace(/^\/lookbook\//, "");
    const filePath = join(PUBLIC_LOOKBOOK, basename);
    if (!existsSync(filePath)) {
      console.warn(`Skip (missing): ${basename}`);
      result.push(meta);
      continue;
    }

    const buf = readFileSync(filePath);
    const mime = MIME[ext(basename)] ?? "image/jpeg";
    const file = new File([buf], basename, { type: mime });

    try {
      const uploadResult = await utapi.uploadFiles(file);
      const data = Array.isArray(uploadResult) ? uploadResult[0] : uploadResult;
      const res = data as {
        url?: string;
        ufsUrl?: string;
        data?: { url?: string; ufsUrl?: string };
        error?: unknown;
      };
      if (res?.error) {
        console.error(`Upload error for ${basename}:`, res.error);
        result.push(meta);
        continue;
      }
      const url =
        res?.url ?? res?.ufsUrl ?? res?.data?.url ?? res?.data?.ufsUrl ?? null;
      if (!url) {
        console.error(`No URL for ${basename}`);
        result.push(meta);
        continue;
      }
      result.push({ ...meta, src: url });
      console.log(`Uploaded ${basename} → ${url.slice(0, 50)}…`);
    } catch (err) {
      console.error(`Failed ${basename}:`, err);
      result.push(meta);
    }
  }

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), "utf-8");
  console.log(`Wrote ${OUTPUT_PATH}. Commit this file so staging/prod use UploadThing URLs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
