/**
 * Fetches logo/assets from each seeded brand's website and saves to scripts/brand-assets/<slug>/.
 * Tries: og:image, apple-touch-icon, favicon, then common paths (/logo.png, etc.).
 *
 * Run: bun run scripts/fetch-brand-assets.ts
 */

import * as cheerio from "cheerio";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ASSETS_DIR = join(process.cwd(), "scripts", "brand-assets");
const ALLOWED_EXT = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const USER_AGENT =
  "Mozilla/5.0 (compatible; BrandAssetFetcher/1.0; +https://github.com/ftc)";

function slug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

const BRANDS: Array<{ name: string; websiteUrl: string }> = [
  { name: "PacSafe", websiteUrl: "https://pacsafe.com/" },
  { name: "Berkey", websiteUrl: "https://www.berkeyfilters.com/" },
  { name: "Cryptomatic", websiteUrl: "https://cryptomatic.io/" },
  { name: "Spout", websiteUrl: "https://www.spoutwater.com/" },
  { name: "Solana", websiteUrl: "https://solana.com/" },
  { name: "Earth Runners", websiteUrl: "https://www.earthrunners.com" },
  { name: "Rawganique", websiteUrl: "https://rawganique.com" },
  { name: "Harvest & Mill", websiteUrl: "https://harvestandmill.com/" },
  { name: "GrapheneOS", websiteUrl: "https://grapheneos.org/" },
  { name: "Home Assistant", websiteUrl: "https://www.home-assistant.io/" },
  { name: "SONOFF", websiteUrl: "https://sonoff.tech" },
  { name: "Everything Smart Technology", websiteUrl: "https://shop.everythingsmart.io/" },
  { name: "Seeed Studio", websiteUrl: "https://www.seeedstudio.com" },
  { name: "DFRobot", websiteUrl: "https://www.dfrobot.com/" },
];

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function extFromUrl(url: string): string {
  const path = new URL(url).pathname.toLowerCase();
  if (path.endsWith(".png")) return ".png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return ".jpg";
  if (path.endsWith(".webp")) return ".webp";
  if (path.endsWith(".gif")) return ".gif";
  return ".png";
}

function extFromContentType(ct: string | null): string {
  if (!ct) return ".png";
  if (ct.includes("png")) return ".png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg";
  if (ct.includes("webp")) return ".webp";
  if (ct.includes("gif")) return ".gif";
  return ".png";
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function downloadImage(url: string): Promise<{ buffer: ArrayBuffer; ext: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/") || ct.includes("svg")) return null;
    const buffer = await res.arrayBuffer();
    const ext = extFromContentType(ct) || extFromUrl(url);
    if (!ALLOWED_EXT.includes(ext)) return null;
    return { buffer, ext };
  } catch {
    return null;
  }
}

function extractImageCandidates(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const candidates: string[] = [];
  const seen = new Set<string>();

  function add(url: string) {
    const u = resolveUrl(url, baseUrl);
    if (u && !seen.has(u)) {
      seen.add(u);
      candidates.push(u);
    }
  }

  $('meta[property="og:image"]').each((_, el) => {
    const c = $(el).attr("content");
    if (c) add(c);
  });
  $('meta[name="twitter:image"]').each((_, el) => {
    const c = $(el).attr("content");
    if (c) add(c);
  });
  $('link[rel="apple-touch-icon"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) add(href);
  });
  $('link[rel="icon"][type="image/png"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) add(href);
  });
  $('link[rel="shortcut icon"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) add(href);
  });
  $('link[rel="icon"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) add(href);
  });
  $('img[src*="logo"], img[class*="logo"], img[id*="logo"]').each((_, el) => {
    const src = $(el).attr("src");
    if (src) add(src);
  });
  $('img[alt*="logo" i]').each((_, el) => {
    const src = $(el).attr("src");
    if (src) add(src);
  });

  return candidates;
}

async function tryCommonPaths(origin: string): Promise<string[]> {
  const paths = [
    "/logo.png",
    "/Logo.png",
    "/logo.jpg",
    "/images/logo.png",
    "/img/logo.png",
    "/assets/logo.png",
    "/static/logo.png",
    "/images/Logo.png",
    "/logo.webp",
    "/favicon.png",
    "/apple-touch-icon.png",
  ];
  const out: string[] = [];
  for (const p of paths) {
    out.push(new URL(p, origin).href);
  }
  return out;
}

async function main() {
  console.log("Fetching brand assets into scripts/brand-assets/...\n");

  for (const brand of BRANDS) {
    const s = slug(brand.name);
    const dir = join(ASSETS_DIR, s);
    mkdirSync(dir, { recursive: true });

    // Skip if we already have a logo (any extension)
    const hasLogo =
      existsSync(join(dir, "logo.png")) ||
      existsSync(join(dir, "logo.jpg")) ||
      existsSync(join(dir, "logo.webp")) ||
      existsSync(join(dir, "logo.jpeg")) ||
      existsSync(join(dir, "logo.gif"));
    if (hasLogo) {
      console.log(`[${brand.name}] Skip (logo already exists)`);
      continue;
    }

    let candidates: string[] = [];
    try {
      const html = await fetchHtml(brand.websiteUrl);
      const base = brand.websiteUrl.replace(/\/?$/, "/");
      candidates = extractImageCandidates(html, base);
      if (candidates.length === 0) {
        candidates = await tryCommonPaths(new URL(brand.websiteUrl).origin);
      }
    } catch (err) {
      console.warn(`[${brand.name}] Failed to fetch HTML:`, err instanceof Error ? err.message : err);
      candidates = await tryCommonPaths(new URL(brand.websiteUrl).origin);
    }

    let saved = false;
    for (const url of candidates) {
      const result = await downloadImage(url);
      if (result) {
        const ext = result.ext;
        const path = join(dir, `logo${ext}`);
        writeFileSync(path, Buffer.from(result.buffer));
        console.log(`[${brand.name}] Saved logo${ext} from ${url.slice(0, 50)}...`);
        saved = true;
        break;
      }
    }
    if (!saved) {
      console.warn(`[${brand.name}] No suitable image found (tried ${candidates.length} URLs).`);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
