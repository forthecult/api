/**
 * Make SOLUNA logo background transparent (black → alpha 0) and resize for web.
 * Output: public/crypto/soluna/soluna-logo.png
 *
 * Run: bun run scripts/make-soluna-logo-transparent.ts [input.png]
 * Or set SOLUNA_IMAGE_PATH.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error sharp types
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const inputPath =
  process.env.SOLUNA_IMAGE_PATH?.trim() ||
  process.argv[2] ||
  resolve(
    ROOT,
    "assets/soluna_300dpi-63c586ec-70b6-48ef-844d-174bf30db3d8.png",
  );
const outputDir = resolve(ROOT, "public/crypto/soluna");
const outputPath = resolve(outputDir, "soluna-logo.png");

async function makeTransparentPng(inputPath: string): Promise<Buffer> {
  const img = sharp(readFileSync(inputPath));
  const { data, info } = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels ?? 4;
  const threshold = 40; // pixels with r,g,b all <= this become transparent
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

async function main() {
  if (!existsSync(inputPath)) {
    console.error("Input not found:", inputPath);
    console.error(
      "Usage: bun run scripts/make-soluna-logo-transparent.ts <path-to-soluna.png>",
    );
    process.exit(1);
  }

  mkdirSync(outputDir, { recursive: true });
  const transparent = await makeTransparentPng(inputPath);
  // Resize to a reasonable size for payment icons (e.g. 128px height keeps aspect)
  const resized = await sharp(transparent)
    .resize(128, null, { fit: "inside" })
    .png()
    .toBuffer();
  writeFileSync(outputPath, resized);
  console.log("Wrote", outputPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
