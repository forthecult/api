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

/** Direct catalog paths (no cache) so fetch/upload works reliably. From product page gallery. */
const SEEED_MEDIA = "https://media-cdn.seeedstudio.com/media/catalog/product";

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  {
    url: `${SEEED_MEDIA}/_/1/_109_2x.png`,
    alt: "Smart Infrared (IR) Mate - Wi-Fi IR remote control hub for Home Assistant",
    title: "Smart Infrared (IR) Mate - Main",
  },
  {
    url: `${SEEED_MEDIA}/1/-/1-109990586-xiao-smart-ir-mate.jpg`,
    alt: "XIAO Smart IR Mate - front view",
    title: "Smart IR Mate - Front",
  },
  {
    url: `${SEEED_MEDIA}/2/-/2-109990586-xiao-smart-ir-mate.jpg`,
    alt: "XIAO Smart IR Mate - view 2",
    title: "Smart IR Mate - View 2",
  },
  {
    url: `${SEEED_MEDIA}/3/-/3-109990586-xiao-smart-ir-mate.jpg`,
    alt: "XIAO Smart IR Mate - view 3",
    title: "Smart IR Mate - View 3",
  },
  {
    url: `${SEEED_MEDIA}/4/-/4-109990586-xiao-smart-ir-mate.jpg`,
    alt: "XIAO Smart IR Mate - view 4",
    title: "Smart IR Mate - View 4",
  },
  {
    url: `${SEEED_MEDIA}/5/-/5-109990586-xiao-smart-ir-mate.jpg`,
    alt: "XIAO Smart IR Mate - view 5",
    title: "Smart IR Mate - View 5",
  },
  {
    url: `${SEEED_MEDIA}/6/-/6-109990586-xiao-smart-ir-mate.jpg`,
    alt: "XIAO Smart IR Mate - view 6",
    title: "Smart IR Mate - View 6",
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
  name: "Smart Infrared (IR) Mate",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
  mainImageAlt:
    "Smart Infrared (IR) Mate - Wi-Fi IR remote hub for Home Assistant. Control TVs, AC, fans.",
  mainImageTitle: "Smart Infrared (IR) Mate | Seeed Studio",
  priceCents: PRICE_CENTS,
  costPerItemCents: COST_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Seeed Studio",
  model: "Smart Infrared (IR) Mate",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription:
    "Smart Infrared (IR) Mate: Wi-Fi IR remote hub for Home Assistant. Control TVs, AC, fans. One-touch learning. Seeed Studio. Buy at Culture.",
  pageTitle: "Smart Infrared (IR) Mate | Seeed Studio | Culture",
  sku: "109990586",
  hasVariants: false,
  continueSellingWhenOutOfStock: true,
  images: PRODUCT_IMAGES,
  availableCountryCodes: ["US"] as const,
};
