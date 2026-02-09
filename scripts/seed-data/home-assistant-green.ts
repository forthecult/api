/**
 * Seed data for Home Assistant Green — official smart home hub.
 * Sourced from Seeed Studio (US warehouse). Brand: Seeed Studio. Category: Smart Home. US price: $158.90.
 *
 * IMAGES: We do not use Seeed's CDN. The URLs below are SOURCE ONLY for the upload script.
 * Run db:upload-curated-product-images after seeding so images are downloaded, optimized, and
 * uploaded to UploadThing; the store then serves images from our CDN (UploadThing), not Seeed.
 *
 * Markets: Seeed US warehouse ships USA only; we restrict to US.
 */

const PRICE_CENTS = 15890; // US $158.90
const PRODUCT_ID = "home-assistant-green";
const PRODUCT_SLUG = "home-assistant-green";
const CATEGORY_ID = "smart-home";

/** Source URLs: 1200x1200 cache (full-size). Run db:upload-curated-product-images to re-host on UploadThing. From product page gallery. */
const SEEED_CACHE =
  "https://media-cdn.seeedstudio.com/media/catalog/product/cache/1/image/1200x1200/9df78eab33525d08d6e5fb8d27136e95";

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  {
    url: `${SEEED_CACHE}/5/-/5-113110024--home-assistant-green-fontall_1.jpg`,
    alt: "Home Assistant Green smart home hub - front view",
    title: "Home Assistant Green - Front",
  },
  {
    url: `${SEEED_CACHE}/2/-/2-113110024--home-assistant-green-45font_1.jpg`,
    alt: "Home Assistant Green - 45° angle",
    title: "Home Assistant Green - Angle",
  },
  {
    url: `${SEEED_CACHE}/3/-/3-113110024--home-assistant-green-back_1.jpg`,
    alt: "Home Assistant Green - back view",
    title: "Home Assistant Green - Back",
  },
  {
    url: `${SEEED_CACHE}/4/-/4-113110024--home-assistant-green-45back_1.jpg`,
    alt: "Home Assistant Green - 45° back",
    title: "Home Assistant Green - 45° Back",
  },
  {
    url: `${SEEED_CACHE}/6/-/6-113110024--home-assistant-green-feature_1.jpg`,
    alt: "Home Assistant Green - feature",
    title: "Home Assistant Green - Feature",
  },
  {
    url: `${SEEED_CACHE}/7/-/7-113110024--home-assistant-green-feature_1.jpg`,
    alt: "Home Assistant Green - feature 2",
    title: "Home Assistant Green - Feature 2",
  },
  {
    url: `${SEEED_CACHE}/8/-/8-113110024--home-assistant-green-feature_1.jpg`,
    alt: "Home Assistant Green - feature 3",
    title: "Home Assistant Green - Feature 3",
  },
  {
    url: `${SEEED_CACHE}/9/-/9-113110024--home-assistant-green-feature_1.jpg`,
    alt: "Home Assistant Green - feature 4",
    title: "Home Assistant Green - Feature 4",
  },
  {
    url: `${SEEED_CACHE}/1/0/10-113110024--home-assistant-green-first.jpg`,
    alt: "Home Assistant Green - first setup",
    title: "Home Assistant Green - Setup",
  },
  {
    url: `${SEEED_CACHE}/1/1/11-113110024--home-assistant-green-size.jpg`,
    alt: "Home Assistant Green - size",
    title: "Home Assistant Green - Size",
  },
];

const FEATURES: string[] = [
  "Official hub developed with the Home Assistant team; OS pre-installed",
  "All data stays local—no required cloud, no data mining",
  "Expandable with Zigbee, Thread, and Matter (Connect ZBT-2, ZWA-2)",
  "One system for all your smart devices; plug-and-play setup",
  "Open-source ecosystem with monthly improvements",
];

const DESCRIPTION = `<p>Home Assistant Green is the official hardware for running Home Assistant: one hub to control lights, climate, media, and hundreds of compatible devices. Everything runs on the device and your local network. No mandatory cloud accounts, no sending sensor data to third parties—automations, dashboards, and integrations stay on your hardware.</p>

<p>Out of the box it’s plug-and-play with Home Assistant OS already installed. Add Zigbee, Thread, or Matter with official Connect modules (ZBT-2, ZWA-2) when you’re ready. The project is open source and actively developed, so you get regular updates and a large community.</p>

<p>If you care about privacy and local control, Green is built for that: your smart home, your rules, your data.</p>`;

export const HOME_ASSISTANT_GREEN = {
  id: PRODUCT_ID,
  name: "Home Assistant Green",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
  mainImageAlt: "Home Assistant Green - official smart home hub with Home Assistant OS, local-first",
  mainImageTitle: "Home Assistant Green | Smart Home Hub | Seeed Studio",
  priceCents: PRICE_CENTS,
  costPerItemCents: PRICE_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Seeed Studio",
  model: "Home Assistant Green",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription:
    "Home Assistant Green: official smart home hub with Home Assistant OS pre-installed. Local-first, expandable for Zigbee, Thread, Matter. Seeed Studio. Buy at Culture.",
  pageTitle: "Home Assistant Green | Smart Home Hub | Culture",
  sku: "113110024",
  hasVariants: false,
  continueSellingWhenOutOfStock: true,
  pageLayout: "long-form" as const,
  images: PRODUCT_IMAGES,
  /** US only. Images must be on UploadThing (run db:upload-curated-product-images)—we do not use Seeed CDN. */
  availableCountryCodes: ["US"] as const,
};
