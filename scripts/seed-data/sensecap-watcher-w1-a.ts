/**
 * Seed data for SenseCAP Watcher W1-A — physical AI agent (ESP32S3 + Himax WiseEye2).
 * Sourced from Seeed Studio (US). Brand: Seeed Studio. Category: Smart Home.
 * US price $78; we add 5% → $81.90. Variants: Clear Enclosure, White Enclosure.
 * https://www.seeedstudio.com/SenseCAP-Watcher-W1-A-p-5979.html
 *
 * IMAGES: Source URLs only. Run db:upload-curated-product-images after seeding.
 * Markets: Seeed US — US only.
 */

const COST_CENTS = 7800; // $78 US
const PRICE_MARKUP = 1.05;
const PRICE_CENTS = Math.round(COST_CENTS * PRICE_MARKUP); // $81.90

const PRODUCT_ID = "sensecap-watcher-w1-a";
const PRODUCT_SLUG = "sensecap-watcher-w1-a";
const CATEGORY_ID = "smart-home";

/** Direct catalog paths (no cache) so fetch/upload works reliably. */
const SEEED_MEDIA = "https://media-cdn.seeedstudio.com/media/catalog/product";

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  {
    url: `${SEEED_MEDIA}/1/1/3/113991315.jpg`,
    alt: "SenseCAP Watcher W1-A - physical AI agent with camera, mic, speaker",
    title: "SenseCAP Watcher W1-A - Main",
  },
  {
    url: `${SEEED_MEDIA}/s/e/sensecap-watcher-w1-a-clear.jpg`,
    alt: "SenseCAP Watcher W1-A Clear Enclosure",
    title: "SenseCAP Watcher - Clear",
  },
  {
    url: `${SEEED_MEDIA}/s/e/sensecap-watcher-w1-a-white.jpg`,
    alt: "SenseCAP Watcher W1-A White Enclosure",
    title: "SenseCAP Watcher - White",
  },
];

const FEATURES: string[] = [
  "ESP32S3 + Himax WiseEye2 HX6538 (Cortex-M55 & Ethos-U55); image and vector processing",
  "Camera, microphone, speaker — see, hear, talk; LLM-enabled SenseCraft suite",
  "Understands commands, perceives surroundings, triggers actions",
  "Clear or White enclosure options",
];

const DESCRIPTION = `<p>SenseCAP Watcher is built on ESP32S3 and incorporates a Himax WiseEye2 HX6538 AI chip with Arm Cortex-M55 and Ethos-U55, excelling in image and vector data processing. With a camera, microphone, and speaker, SenseCAP Watcher can see, hear, and talk. The LLM-enabled SenseCraft suite lets it understand your commands, perceive its surroundings, and trigger actions accordingly.</p>

<p>Choose the Clear or White enclosure to match your space. Ideal for smarter rooms, offices, or maker projects.</p>`;

const OPTION_DEFINITIONS = [
  { name: "Color", values: ["Clear Enclosure", "White Enclosure"] },
];

const VARIANTS: Array<{
  id: string;
  color: string;
  size: string | null;
  priceCents: number;
  sku: string;
  imageUrl: string;
  imageAlt: string;
  imageTitle: string;
}> = [
  {
    id: `${PRODUCT_ID}-clear`,
    color: "Clear Enclosure",
    size: null,
    priceCents: PRICE_CENTS,
    sku: "113991315-Clear",
    imageUrl: PRODUCT_IMAGES[1]!.url,
    imageAlt: "SenseCAP Watcher W1-A Clear Enclosure",
    imageTitle: "SenseCAP Watcher - Clear Enclosure",
  },
  {
    id: `${PRODUCT_ID}-white`,
    color: "White Enclosure",
    size: null,
    priceCents: PRICE_CENTS,
    sku: "113991315-White",
    imageUrl: PRODUCT_IMAGES[2]!.url,
    imageAlt: "SenseCAP Watcher W1-A White Enclosure",
    imageTitle: "SenseCAP Watcher - White Enclosure",
  },
];

export const SENSECAP_WATCHER_W1_A = {
  id: PRODUCT_ID,
  name: "SenseCAP Watcher W1-A — The Physical AI Agent for Smarter Spaces",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
  mainImageAlt:
    "SenseCAP Watcher W1-A - physical AI agent with camera, microphone, speaker. Clear or White enclosure.",
  mainImageTitle: "SenseCAP Watcher W1-A | Seeed Studio",
  priceCents: PRICE_CENTS,
  costPerItemCents: COST_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Seeed Studio",
  model: "SenseCAP Watcher W1-A",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription:
    "SenseCAP Watcher W1-A: physical AI agent with ESP32S3 and WiseEye2. See, hear, talk; SenseCraft LLM. Clear or White enclosure. Seeed Studio. Buy at Culture.",
  pageTitle: "SenseCAP Watcher W1-A | Seeed Studio | Culture",
  sku: "113991315",
  hasVariants: true,
  optionDefinitions: OPTION_DEFINITIONS,
  variants: VARIANTS,
  continueSellingWhenOutOfStock: true,
  images: PRODUCT_IMAGES,
  availableCountryCodes: ["US"] as const,
};
