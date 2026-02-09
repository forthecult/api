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

/** Direct catalog paths (no cache) so fetch/upload works reliably. From product page pattern. */
const SEEED_MEDIA = "https://media-cdn.seeedstudio.com/media/catalog/product";

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  {
    url: `${SEEED_MEDIA}/1/0/2/102110958.jpg`,
    alt: "LinkStar H68K V2 router - quad-core RK3568, dual-2.5G and dual-1G Ethernet, Wi-Fi 6",
    title: "LinkStar-WiFi Router - Main",
  },
  {
    url: `${SEEED_MEDIA}/l/i/linkstar-h68k-v2-02.jpg`,
    alt: "LinkStar-WiFi Router - ports and interfaces",
    title: "LinkStar-WiFi Router - Ports",
  },
  {
    url: `${SEEED_MEDIA}/1/-/1-102110958-linkstar-h68k-v2.jpg`,
    alt: "LinkStar H68K V2 - view 1",
    title: "LinkStar-WiFi Router - View 1",
  },
  {
    url: `${SEEED_MEDIA}/3/-/3-102110958-linkstar-h68k-v2.jpg`,
    alt: "LinkStar H68K V2 - view 3",
    title: "LinkStar-WiFi Router - View 3",
  },
  {
    url: `${SEEED_MEDIA}/4/-/4-102110958-linkstar-h68k-v2.jpg`,
    alt: "LinkStar H68K V2 - view 4",
    title: "LinkStar-WiFi Router - View 4",
  },
  {
    url: `${SEEED_MEDIA}/5/-/5-102110958-linkstar-h68k-v2.jpg`,
    alt: "LinkStar H68K V2 - view 5",
    title: "LinkStar-WiFi Router - View 5",
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
