/**
 * Seed data for LinkStar-H68K-1432 V2 — quad-core router with dual-2.5G + dual-1G Ethernet, Wi-Fi 6.
 * Sourced from Seeed Studio (US). Only V2. Brand: Seeed Studio. Category: Smart Home.
 * US price $104; we add 5% → $109.20.
 * https://www.seeedstudio.com/LinkStar-H68K-1432-V2-p-5886.html
 *
 * IMAGES: Source URLs only. Run db:upload-curated-product-images after seeding.
 * Markets: Seeed US warehouse — US only.
 */

const COST_CENTS = 10400; // $104 US
const PRICE_MARKUP = 1.05;
const PRICE_CENTS = Math.round(COST_CENTS * PRICE_MARKUP); // $109.20

const PRODUCT_ID = "linkstar-h68k-1432-v2";
const PRODUCT_SLUG = "linkstar-h68k-1432-v2";
const CATEGORY_ID = "smart-home";

/** Cache path from product gallery (from Seeed product page; real images). */
const SEEED_CACHE =
  "https://media-cdn.seeedstudio.com/media/catalog/product/cache/bb49d3ec4ee05b6f018e93f896b8a25d";

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  {
    url: `${SEEED_CACHE}/1/-/1-102110958-linkstar-h68k-1432-v2-45font.jpg`,
    alt: "LinkStar H68K V2 router - quad-core RK3568, dual-2.5G and dual-1G Ethernet, Wi-Fi 6",
    title: "LinkStar-WiFi Router - Main",
  },
  {
    url: `${SEEED_CACHE}/2/-/2-102110958-linkstar-h68k-1432-v2-font.jpg`,
    alt: "LinkStar H68K V2 - front view",
    title: "LinkStar-WiFi Router - Front",
  },
  {
    url: `${SEEED_CACHE}/3/-/3-102110958-linkstar-h68k-1432-v2-back.jpg`,
    alt: "LinkStar H68K V2 - back view",
    title: "LinkStar-WiFi Router - Back",
  },
  {
    url: `${SEEED_CACHE}/4/-/4-102110958-linkstar-h68k-1432-v2-45back.jpg`,
    alt: "LinkStar H68K V2 - 45° back view",
    title: "LinkStar-WiFi Router - 45° Back",
  },
  {
    url: `${SEEED_CACHE}/5/-/5-102110958-linkstar-h68k-1432-v2-all.jpg`,
    alt: "LinkStar H68K V2 - all components",
    title: "LinkStar-WiFi Router - All",
  },
  {
    url: `${SEEED_CACHE}/6/-/6-102110958-linkstar-h68k-1432-v2-feature.jpg`,
    alt: "LinkStar H68K V2 - feature",
    title: "LinkStar-WiFi Router - Feature 6",
  },
  {
    url: `${SEEED_CACHE}/7/-/7-102110958-linkstar-h68k-1432-v2-feature.jpg`,
    alt: "LinkStar H68K V2 - feature",
    title: "LinkStar-WiFi Router - Feature 7",
  },
  {
    url: `${SEEED_CACHE}/8/-/8-102110958-linkstar-h68k-1432-v2-feature.jpg`,
    alt: "LinkStar H68K V2 - feature",
    title: "LinkStar-WiFi Router - Feature 8",
  },
  {
    url: `${SEEED_CACHE}/9/-/9-102110958-linkstar-h68k-1432-v2-feature.jpg`,
    alt: "LinkStar H68K V2 - feature",
    title: "LinkStar-WiFi Router - Feature 9",
  },
  {
    url: `${SEEED_CACHE}/1/0/10-102110958-linkstar-h68k-1432-v2-feature.jpg`,
    alt: "LinkStar H68K V2 - feature",
    title: "LinkStar-WiFi Router - Feature 10",
  },
];

const FEATURES: string[] = [
  "Quad-core Cortex-A55 RK3568; 4 Ethernet (dual-2.5G + dual-1G), Wi-Fi 6",
  "High storage capacity and media player; indoor use",
  "Better communication and heat dissipation than first-gen H68K",
  "Reasonable interface layout; OpenWRT-friendly",
];

const DESCRIPTION = `<p>LinkStar-H68K-V2 router equips a quad-core Cortex-A55 RK3568 chip with 4 Ethernet interfaces (dual-2.5G and dual-1G) and Wi-Fi 6. It offers high storage capacity and media player functionality, recommended for indoor use. Compared with the first H68K generation, it has better communication and heat dissipation, and a more convenient interface layout.</p>

<p>Ideal for homelab, NAS, or smart home gateway use with OpenWRT or other Linux distros.</p>`;

export const LINKSTAR_H68K_1432_V2 = {
  id: PRODUCT_ID,
  name: "LinkStar-WiFi Router",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
  mainImageAlt:
    "LinkStar-WiFi Router - quad-core RK3568, dual-2.5G and dual-1G Ethernet, Wi-Fi 6",
  mainImageTitle: "LinkStar-WiFi Router | Seeed Studio",
  priceCents: PRICE_CENTS,
  costPerItemCents: COST_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Seeed Studio",
  model: "LinkStar-WiFi Router",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription:
    "LinkStar-WiFi Router: quad-core RK3568 router with dual-2.5G and dual-1G Ethernet, Wi-Fi 6. Seeed Studio. Buy at Culture.",
  pageTitle: "LinkStar-WiFi Router | Seeed Studio | Culture",
  sku: "102110958",
  hasVariants: false,
  continueSellingWhenOutOfStock: true,
  images: PRODUCT_IMAGES,
  availableCountryCodes: ["US"] as const,
};
