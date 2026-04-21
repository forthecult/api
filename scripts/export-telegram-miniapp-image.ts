#!/usr/bin/env bun
/**
 * Exports public/telegram-miniapp-placeholder.svg to PNG at 640x360
 * for Telegram Mini App image (BotFather). Run: bun run scripts/export-telegram-miniapp-image.ts
 */
import sharp from "sharp";
import { join } from "node:path";

const src = join(
  import.meta.dir,
  "..",
  "public",
  "telegram-miniapp-placeholder.svg",
);
const dest = join(
  import.meta.dir,
  "..",
  "public",
  "telegram-miniapp-placeholder.png",
);

await sharp(src).resize(640, 360).png().toFile(dest);

console.log("Wrote", dest);
