/**
 * Seed data for Home Assistant Green — official smart home hub.
 * Sourced from https://www.seeedstudio.com/Home-Assistant-Green-p-5792.html (US warehouse).
 * Brand: Seeed Studio. Category: Smart Home. US price: $158.90.
 * Images: full-size catalog URLs (no cache). Run db:upload-curated-product-images to upload to UploadThing.
 * Markets: Seeed US warehouse ships USA only; we restrict to US.
 */

const PRICE_CENTS = 15890; // US $158.90
const PRODUCT_ID = "home-assistant-green";
const PRODUCT_SLUG = "home-assistant-green";
const CATEGORY_ID = "smart-home";

/** Full-size images (no cache path). Upload script will pull, optimize, and upload to UploadThing. */
const SEEED_MEDIA = "https://media-cdn.seeedstudio.com/media/catalog/product";

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  {
    url: `${SEEED_MEDIA}/5/-/5-113110024--home-assistant-green-fontall_1.jpg`,
    alt: "Home Assistant Green smart home hub - front view",
    title: "Home Assistant Green - Front",
  },
  {
    url: `${SEEED_MEDIA}/2/-/2-113110024--home-assistant-green-45font_1.jpg`,
    alt: "Home Assistant Green - 45° angle",
    title: "Home Assistant Green - Angle",
  },
  {
    url: `${SEEED_MEDIA}/3/-/3-113110024--home-assistant-green-back_1.jpg`,
    alt: "Home Assistant Green - back view",
    title: "Home Assistant Green - Back",
  },
  {
    url: `${SEEED_MEDIA}/6/-/6-113110024--home-assistant-green-feature_1.jpg`,
    alt: "Home Assistant Green - feature",
    title: "Home Assistant Green - Feature",
  },
  {
    url: `${SEEED_MEDIA}/1/0/10-113110024--home-assistant-green-first.jpg`,
    alt: "Home Assistant Green - first setup",
    title: "Home Assistant Green - Setup",
  },
];

const FEATURES: string[] = [
  "Official smart home hub developed with the Home Assistant team",
  "Home Assistant OS pre-installed — plug-and-play setup",
  "Expandable with Zigbee, Thread, and Matter via official accessories (Connect ZBT-2, ZWA-2)",
  "All data stored locally by default — privacy-focused",
  "Thriving open-source ecosystem; improved every month",
  "Control all smart devices from one system",
  "Effortless setup and local-first automation",
];

const DESCRIPTION = `<p>Home Assistant Green is the easiest and most privacy-focused way to automate your home. It offers an effortless setup and allows you to control all your smart devices with just one system, where all data is stored locally by default.</p>
<p>This board benefits from the thriving Home Assistant ecosystem and is improved every month by the open-source community. It comes with Home Assistant OS pre-installed for a true plug-and-play experience and can be expanded to support Zigbee, Thread, and Matter via official accessories.</p>
<p><strong>Why local?</strong> Keep your smart home data in your home — no mandatory cloud, no data mining. Run automations, dashboards, and integrations entirely on your own hardware.</p>`;

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
  /** Seeed US warehouse ships to USA only. Run db:upload-curated-product-images so images are on UploadThing. */
  availableCountryCodes: ["US"] as const,
};
