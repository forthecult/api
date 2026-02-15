import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { LookbookImage } from "~/lib/lookbook-data";

import { LOOKBOOK_IMAGES } from "~/lib/lookbook-data";

const DATA_PATH = join(process.cwd(), "data", "lookbook-images.json");

/**
 * Returns lookbook images: from data/lookbook-images.json if present (UploadThing URLs),
 * otherwise the static list from public/lookbook.
 * Call from server components only.
 */
export function getLookbookImages(): LookbookImage[] {
  if (!existsSync(DATA_PATH)) {
    return LOOKBOOK_IMAGES;
  }
  try {
    const raw = readFileSync(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0] as Record<string, unknown>;
      if (typeof first?.src === "string" && first.src.startsWith("http")) {
        return parsed as LookbookImage[];
      }
    }
  } catch {
    // ignore invalid or missing file
  }
  return LOOKBOOK_IMAGES;
}
