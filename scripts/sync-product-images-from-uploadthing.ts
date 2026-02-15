/**
 * List files from UploadThing, build product image payload by matching filenames
 * (minirig-4-bluetooth-speaker-0, minirig-subwoofer-4-0, etc.), then PATCH products
 * via admin API so the backend uses those CDN URLs.
 *
 * Use when images were uploaded to UploadThing multiple times but admin was never updated.
 * Requires: UPLOADTHING_TOKEN (base64 JSON: { apiKey, appId, regions }), ADMIN_AI_API_KEY, MAIN_APP_URL.
 * Run from ftc so .env is loaded, or pass env vars.
 *
 * Usage:
 *   cd ftc && MAIN_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> bun run scripts/sync-product-images-from-uploadthing.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Load .env if present (Bun and Node)
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      const key = m[1]!;
      const val = m[2]!.replace(/^["']|["']$/g, "").trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const MAIN_APP_URL =
  process.env.MAIN_APP_URL?.trim() || "https://forthecult.store";
const API_KEY =
  process.env.ADMIN_AI_API_KEY?.trim() || process.env.ADMIN_API_KEY?.trim();

// Use same normalization as app (strip quotes)
const rawToken = process.env.UPLOADTHING_TOKEN;
const UPLOADTHING_TOKEN =
  rawToken == null || rawToken === ""
    ? undefined
    : rawToken.trim().replace(/^['"]|['"]$/g, "");

if (!API_KEY) {
  console.error("Set ADMIN_AI_API_KEY or ADMIN_API_KEY.");
  process.exit(1);
}
if (!UPLOADTHING_TOKEN) {
  console.error(
    "Set UPLOADTHING_TOKEN. It must be base64-encoded JSON { apiKey, appId, regions } (same as production).",
  );
  process.exit(1);
}

const API_BASE = MAIN_APP_URL.replace(/\/$/, "");
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

// Minirig: filename prefix -> slug, num product images, variant colors in order
const MINIRIG_MAP: Record<
  string,
  {
    slug: string;
    numImages: number;
    variantColors: string[];
    mainImageAlt: string;
    mainImageTitle: string;
    imageMeta: Array<{ alt: string; title: string }>;
  }
> = {
  "minirig-4-bluetooth-speaker": {
    slug: "minirig-4-bluetooth-speaker",
    numImages: 7,
    variantColors: ["Black", "Blue", "Brushed Silver", "Green", "Red"],
    mainImageAlt:
      "Minirig 4 Bluetooth Speaker - portable wireless speaker, Bristol UK",
    mainImageTitle: "Minirig 4 Bluetooth Speaker | Portable Bluetooth Speaker",
    imageMeta: [
      {
        alt: "Minirig 4 Bluetooth Speaker Black - portable wireless speaker, designed in Bristol UK",
        title: "Minirig 4 Bluetooth Speaker - Black",
      },
      {
        alt: "Minirig 4 Black grille and top cap",
        title: "Minirig 4 - Grille",
      },
      { alt: "Minirig 4 bottom cap and controls", title: "Minirig 4 - Bottom" },
      {
        alt: "Minirig 4 with protective travel case open",
        title: "Minirig 4 - Case open",
      },
      { alt: "Minirig 4 travel case closed", title: "Minirig 4 - Case closed" },
      {
        alt: "Minirig 4 USB-C charging cable",
        title: "Minirig 4 - Charger cable",
      },
      {
        alt: "Minirig 4 eco-friendly recycled packaging",
        title: "Minirig 4 - Packaging",
      },
    ],
  },
  "minirig-subwoofer-4": {
    slug: "minirig-subwoofer-4",
    numImages: 4,
    variantColors: [
      "Black",
      "Blue",
      "Brushed Silver",
      "Green",
      "Purple",
      "Red",
    ],
    mainImageAlt:
      "Minirig Subwoofer 4 - portable wireless subwoofer, Bristol UK",
    mainImageTitle: "Minirig Subwoofer 4 | Portable Subwoofer",
    imageMeta: [
      {
        alt: "Minirig Subwoofer 4 Black - portable wireless subwoofer, Bristol UK",
        title: "Minirig Subwoofer 4 - Black",
      },
      {
        alt: "Minirig Subwoofer 4 grille top view",
        title: "Minirig Subwoofer 4 - Grille",
      },
      {
        alt: "Minirig Subwoofer 4 port view",
        title: "Minirig Subwoofer 4 - Port",
      },
      {
        alt: "Minirig Subwoofer 4 in the box",
        title: "Minirig Subwoofer 4 - In the box",
      },
    ],
  },
};

// Sonoff: upload script uses sonoff-${slug.replace(/^sonoff-/, "")} and sonoff-...-${i} for i > 0, so prefix = slug
const SONOFF_MAP: Record<
  string,
  {
    slug: string;
    numImages: number;
    variantColors: string[];
    mainImageAlt: string;
    mainImageTitle: string;
    imageMeta: Array<{ alt: string; title: string }>;
  }
> = {
  "sonoff-zigbee-wireless-switch-snzb-01p": {
    slug: "sonoff-zigbee-wireless-switch-snzb-01p",
    numImages: 2,
    variantColors: [],
    mainImageAlt:
      "SONOFF SNZB-01P Zigbee wireless switch - compact smart button for single, double, long press",
    mainImageTitle:
      "SONOFF Zigbee Wireless Switch SNZB-01P | Smart Home | Culture",
    imageMeta: [
      {
        alt: "SONOFF SNZB-01P Zigbee wireless switch",
        title: "SONOFF SNZB-01P - Main",
      },
      {
        alt: "SONOFF SNZB-01P wireless switch - button and mounting",
        title: "SONOFF SNZB-01P - Mounting",
      },
    ],
  },
  "sonoff-zigbee-motion-sensor-snzb-03p": {
    slug: "sonoff-zigbee-motion-sensor-snzb-03p",
    numImages: 1,
    variantColors: [],
    mainImageAlt:
      "SONOFF SNZB-03P Zigbee motion sensor - low-power PIR for lights and security",
    mainImageTitle:
      "SONOFF SNZB-03P Zigbee Motion Sensor | Smart Home | Culture",
    imageMeta: [
      {
        alt: "SONOFF SNZB-03P Zigbee motion sensor",
        title: "SONOFF SNZB-03P - Main",
      },
    ],
  },
  "sonoff-zigbee-door-window-sensor-snzb-04p": {
    slug: "sonoff-zigbee-door-window-sensor-snzb-04p",
    numImages: 1,
    variantColors: [],
    mainImageAlt:
      "SONOFF SNZB-04P Zigbee door/window sensor - tamper-proof, 5-year battery",
    mainImageTitle:
      "SONOFF SNZB-04P Zigbee Door/Window Sensor | Smart Home | Culture",
    imageMeta: [
      {
        alt: "SONOFF SNZB-04P Zigbee door window sensor",
        title: "SONOFF SNZB-04P - Main",
      },
    ],
  },
  "sonoff-zigbee-temperature-humidity-sensor-snzb-02p": {
    slug: "sonoff-zigbee-temperature-humidity-sensor-snzb-02p",
    numImages: 1,
    variantColors: [],
    mainImageAlt:
      "SONOFF SNZB-02P Zigbee temperature and humidity sensor - Swiss sensor ±0.2°C",
    mainImageTitle:
      "SONOFF SNZB-02P Temperature & Humidity Sensor | Smart Home | Culture",
    imageMeta: [
      {
        alt: "SONOFF SNZB-02P temperature humidity sensor",
        title: "SONOFF SNZB-02P - Main",
      },
    ],
  },
  "sonoff-l3-pro-rgbic-smart-led-strip-lights": {
    slug: "sonoff-l3-pro-rgbic-smart-led-strip-lights",
    numImages: 1,
    variantColors: [],
    mainImageAlt:
      "SONOFF L3 Pro RGBIC smart LED strip 5m - multiple colors, music sync, voice control",
    mainImageTitle:
      "SONOFF L3 Pro RGBIC Smart LED Strip 5M | Smart Home | Culture",
    imageMeta: [
      {
        alt: "SONOFF L3 Pro RGBIC LED strip lights",
        title: "SONOFF L3 Pro RGBIC - Main",
      },
    ],
  },
  "sonoff-zigbee-smart-plug-iplug-s40-lite": {
    slug: "sonoff-zigbee-smart-plug-iplug-s40-lite",
    numImages: 1,
    variantColors: [],
    mainImageAlt:
      "SONOFF Zigbee smart plug S40 Lite - 15A 1800W, Zigbee router",
    mainImageTitle: "SONOFF Zigbee Smart Plug S40 Lite | Smart Home | Culture",
    imageMeta: [
      {
        alt: "SONOFF Zigbee smart plug S40 Lite",
        title: "SONOFF S40 Lite - Main",
      },
    ],
  },
  "sonoff-zigbee-smart-water-valve": {
    slug: "sonoff-zigbee-smart-water-valve",
    numImages: 1,
    variantColors: [],
    mainImageAlt:
      "SONOFF Zigbee smart water valve - automated irrigation, schedule and capacity modes",
    mainImageTitle: "SONOFF Zigbee Smart Water Valve | Smart Home | Culture",
    imageMeta: [
      {
        alt: "SONOFF Zigbee smart water valve",
        title: "SONOFF Smart Water Valve - Main",
      },
    ],
  },
};

const PRODUCT_MAP = { ...MINIRIG_MAP, ...SONOFF_MAP };

/** Fallback: for Sonoff products with no images from prefix matching, match any file whose name contains this keyword. */
const SONOFF_FALLBACK_KEYWORDS: Record<string, string[]> = {
  "sonoff-zigbee-smart-water-valve": ["water-valve", "swv"],
  "sonoff-zigbee-smart-plug-iplug-s40-lite": [
    "s40-lite",
    "iplug-s40",
    "s40-lite-zigbee",
  ],
  "sonoff-l3-pro-rgbic-smart-led-strip-lights": [
    "l3-pro",
    "rgbic",
    "led-strip",
  ],
};

type ProductPayload = {
  imageUrl: string;
  mainImageAlt: string;
  mainImageTitle: string;
  images: Array<{ url: string; alt: string; title: string }>;
  variantImageUrls?: Record<string, string>;
};

function parseName(name: string): { prefix: string; index: number } | null {
  const base = name.replace(/\.(webp|png|jpg|jpeg)$/i, "");
  const lastDash = base.lastIndexOf("-");
  if (lastDash === -1) return null;
  const tail = base.slice(lastDash + 1);
  const index = parseInt(tail, 10);
  // Only treat as index if tail is exactly a number (e.g. "0", "1" not "01p")
  if (String(index) !== tail || tail === "") return null;
  const prefix = base.slice(0, lastDash);
  return { prefix, index };
}

function baseNameWithoutExtension(name: string): string {
  return name.replace(/\.(webp|png|jpg|jpeg)$/i, "");
}

async function main() {
  const { UTApi } = await import("uploadthing/server");
  const utapi = new UTApi({ token: UPLOADTHING_TOKEN });

  const listResult = (await utapi.listFiles({ limit: 300 })) as {
    files?: Array<{ key: string; name: string }>;
    hasMore?: boolean;
  };
  const files = listResult?.files ?? [];
  if (files.length === 0) {
    console.error(
      "No files returned from UploadThing. Check UPLOADTHING_TOKEN and app.",
    );
    process.exit(1);
  }

  const keys = files.map((f) => f.key);
  const urlResults = await utapi.getFileUrls(keys);
  const urlList = Array.isArray(urlResults)
    ? urlResults
    : ((urlResults as { data?: Array<{ key: string; url: string }> }).data ??
      []);
  const keyToUrl = new Map(urlList.map((r) => [r.key, r.url]));

  const byPrefixAndIndex = new Map<string, Map<number, string>>();
  const knownPrefixes = new Set(Object.keys(PRODUCT_MAP));
  for (const f of files) {
    const url = keyToUrl.get(f.key);
    if (!url) continue;
    const base = baseNameWithoutExtension(f.name);
    let prefix: string;
    let index: number;
    const parsed = parseName(f.name);
    if (parsed) {
      prefix = parsed.prefix;
      index = parsed.index;
    } else if (knownPrefixes.has(base)) {
      prefix = base;
      index = 0;
    } else {
      continue;
    }
    let map = byPrefixAndIndex.get(prefix);
    if (!map) {
      map = new Map();
      byPrefixAndIndex.set(prefix, map);
    }
    map.set(index, url);
  }

  const payloadBySlug = new Map<string, ProductPayload>();

  for (const [prefix, meta] of Object.entries(PRODUCT_MAP)) {
    const indexToUrl = byPrefixAndIndex.get(prefix);
    if (!indexToUrl || indexToUrl.size === 0) {
      console.warn("No UploadThing files found for prefix:", prefix);
      continue;
    }
    const numImages = meta.numImages;
    const images: Array<{ url: string; alt: string; title: string }> = [];
    for (let i = 0; i < numImages; i++) {
      const url = indexToUrl.get(i);
      if (!url) continue;
      const im = meta.imageMeta[i];
      images.push({ url, alt: im?.alt ?? "", title: im?.title ?? "" });
    }
    if (images.length === 0) {
      console.warn("No product images for", meta.slug);
      continue;
    }
    const variantImageUrls: Record<string, string> = {};
    meta.variantColors.forEach((color, i) => {
      const url = indexToUrl.get(numImages + i);
      if (url) variantImageUrls[color] = url;
    });
    payloadBySlug.set(meta.slug, {
      imageUrl: images[0]!.url,
      mainImageAlt: meta.mainImageAlt,
      mainImageTitle: meta.mainImageTitle,
      images,
      variantImageUrls:
        Object.keys(variantImageUrls).length > 0 ? variantImageUrls : undefined,
    });
  }

  // Fallback for Sonoff products with no images: match any UploadThing file whose name contains a product-specific keyword
  for (const [slug, keywords] of Object.entries(SONOFF_FALLBACK_KEYWORDS)) {
    if (payloadBySlug.get(slug)?.images.length) continue;
    const meta = SONOFF_MAP[slug];
    if (!meta) continue;
    const baseLower = (name: string) =>
      baseNameWithoutExtension(name).toLowerCase();
    for (const f of files) {
      const url = keyToUrl.get(f.key);
      if (!url) continue;
      const name = baseLower(f.name);
      if (!keywords.some((kw) => name.includes(kw))) continue;
      payloadBySlug.set(slug, {
        imageUrl: url,
        mainImageAlt: meta.mainImageAlt,
        mainImageTitle: meta.mainImageTitle,
        images: [
          {
            url,
            alt: meta.imageMeta[0]?.alt ?? "",
            title: meta.imageMeta[0]?.title ?? "",
          },
        ],
      });
      console.log("Fallback: assigned image for", slug, "from file", f.name);
      break;
    }
  }

  if (payloadBySlug.size === 0) {
    console.error(
      "No product payloads built. UploadThing files may use different naming (e.g. minirig-4-bluetooth-speaker-0.webp).",
    );
    process.exit(1);
  }

  const listRes = await fetch(`${API_BASE}/api/admin/products?limit=200`, {
    headers,
  });
  if (!listRes.ok) throw new Error(`Products: ${listRes.status}`);
  const listData = (await listRes.json()) as {
    items?: Array<{ id: string; slug?: string; name: string }>;
  };
  const products = listData.items ?? [];
  const bySlug = new Map(products.map((p) => [(p.slug ?? "").trim(), p]));

  let updated = 0;
  for (const [slug, spec] of payloadBySlug) {
    const product = bySlug.get(slug);
    if (!product) {
      console.warn("Product not found:", slug);
      continue;
    }
    const getRes = await fetch(`${API_BASE}/api/admin/products/${product.id}`, {
      headers,
    });
    if (!getRes.ok) {
      console.error("GET", product.name, getRes.status);
      continue;
    }
    const current = (await getRes.json()) as {
      variants?: Array<{
        id: string;
        color?: string | null;
        size?: string | null;
        sku?: string | null;
        label?: string | null;
        stockQuantity?: number | null;
        priceCents?: number;
        imageUrl?: string | null;
        imageAlt?: string | null;
        imageTitle?: string | null;
      }>;
    };
    const variants = current.variants ?? [];
    const variantBodies =
      spec.variantImageUrls && variants.length > 0
        ? variants.map((v) => {
            const color = (v.color ?? "").trim();
            const newUrl = color ? spec.variantImageUrls![color] : undefined;
            return {
              id: v.id,
              size: v.size ?? null,
              color: v.color ?? null,
              sku: v.sku ?? null,
              label: v.label ?? null,
              stockQuantity: v.stockQuantity ?? null,
              priceCents: v.priceCents,
              imageUrl: (newUrl ?? v.imageUrl)?.trim() ?? null,
              imageAlt: v.imageAlt ?? null,
              imageTitle: v.imageTitle ?? null,
            };
          })
        : undefined;

    const body = {
      imageUrl: spec.imageUrl,
      mainImageAlt: spec.mainImageAlt,
      mainImageTitle: spec.mainImageTitle,
      images: spec.images.map((img, i) => ({
        url: img.url,
        alt: img.alt,
        title: img.title,
        sortOrder: i,
      })),
      ...(variantBodies && { variants: variantBodies }),
    };

    const patchRes = await fetch(
      `${API_BASE}/api/admin/products/${product.id}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      },
    );
    if (!patchRes.ok) {
      console.error(
        "PATCH",
        product.name,
        patchRes.status,
        await patchRes.text(),
      );
      continue;
    }
    updated += 1;
    console.log("Updated", product.name);
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(
    "Done. Updated",
    updated,
    "product(s) with images from UploadThing.",
  );
  if (updated === 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
