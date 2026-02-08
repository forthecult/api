/**
 * Seed data for XIAO Smart IR Mate — Wi‑Fi IR remote hub for Home Assistant.
 * Sourced from Seeed Studio (US). Brand: Seeed Studio. Category: Smart Home.
 * US price $11; we add 5% → $11.55.
 * https://www.seeedstudio.com/XIAO-Smart-IR-Mate-p-6492.html
 *
 * IMAGES: Source URLs only. Run db:upload-curated-product-images after seeding.
 * Markets: Seeed US — US only.
 */

const COST_CENTS = 1100; // $11 US
const PRICE_MARKUP = 1.05;
const PRICE_CENTS = Math.round(COST_CENTS * PRICE_MARKUP); // $11.55

const PRODUCT_ID = "xiao-smart-ir-mate";
const PRODUCT_SLUG = "xiao-smart-ir-mate";
const CATEGORY_ID = "smart-home";

const SEEED_CACHE =
  "https://media-cdn.seeedstudio.com/media/catalog/product/cache/1/image/1200x1200/9df78eab33525d08d6e5fb8d27136e95";

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  {
    url: `${SEEED_CACHE}/1/0/9/109990586.jpg`,
    alt: "XIAO Smart IR Mate - Wi-Fi IR remote control hub for Home Assistant",
    title: "XIAO Smart IR Mate - Main",
  },
];

const FEATURES: string[] = [
  "Compact smart IR remote hub for Home Assistant; XIAO ESP32-C3",
  "Control TVs, AC, fans via phone or automations; one-touch learning",
  "Haptic feedback; make traditional IR devices smart",
];

const DESCRIPTION = `<p>The XIAO IR Mate is a compact smart infrared remote control hub designed for Home Assistant. With the XIAO ESP32-C3 at its core, it integrates with Home Assistant so you can control traditional IR appliances—TVs, air conditioners, fans—from your phone or automation routines. One-touch learning and haptic feedback make it easy to add legacy devices to your smart home.</p>`;

export const XIAO_SMART_IR_MATE = {
  id: PRODUCT_ID,
  name: "XIAO Smart IR Mate",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
  mainImageAlt:
    "XIAO Smart IR Mate - Wi-Fi IR remote hub for Home Assistant. Control TVs, AC, fans.",
  mainImageTitle: "XIAO Smart IR Mate | Seeed Studio",
  priceCents: PRICE_CENTS,
  costPerItemCents: COST_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Seeed Studio",
  model: "XIAO Smart IR Mate",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription:
    "XIAO Smart IR Mate: Wi-Fi IR remote hub for Home Assistant. Control TVs, AC, fans. One-touch learning. Seeed Studio. Buy at Culture.",
  pageTitle: "XIAO Smart IR Mate | Seeed Studio | Culture",
  sku: "109990586",
  hasVariants: false,
  continueSellingWhenOutOfStock: true,
  images: PRODUCT_IMAGES,
  availableCountryCodes: ["US"] as const,
};
