/**
 * Seed data for Home Assistant Voice Preview Edition — voice assistant for Home Assistant.
 * Sourced from https://www.seeedstudio.com/Home-Assistant-Voice-p-6998.html (US warehouse).
 * Brand: Seeed Studio. Category: Smart Home. US price: $59.00.
 * Shipping: Seeed US warehouse ships to USA only; CN to most countries, DE to EU. No product restriction = available everywhere.
 */

const PRICE_CENTS = 5900; // US $59.00
const PRODUCT_ID = "home-assistant-voice";
const PRODUCT_SLUG = "home-assistant-voice";
const CATEGORY_ID = "smart-home";

const SEEED_CDN = "https://media-cdn.seeedstudio.com/media/catalog/product/cache/48035b5512857d0ab907b31a092da78f";

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  {
    url: `${SEEED_CDN}/h/o/home_assitant_voice.jpg`,
    alt: "Home Assistant Voice Preview Edition - voice assistant for Home Assistant",
    title: "Home Assistant Voice - Main",
  },
  {
    url: `${SEEED_CDN}/v/o/voice_preview_edition_-_device_-_5._top.png`,
    alt: "Home Assistant Voice - top view",
    title: "Home Assistant Voice - Top",
  },
  {
    url: `${SEEED_CDN}/v/o/voice_preview_edition_-_device_-_7._front.png`,
    alt: "Home Assistant Voice - front",
    title: "Home Assistant Voice - Front",
  },
  {
    url: `${SEEED_CDN}/v/o/voice_preview_edition_-_device_-_8._back.png`,
    alt: "Home Assistant Voice - back",
    title: "Home Assistant Voice - Back",
  },
  {
    url: `${SEEED_CDN}/v/o/voice_preview_edition_-_packaging_-_4._open_with_contents.png`,
    alt: "Home Assistant Voice - packaging and contents",
    title: "Home Assistant Voice - Contents",
  },
];

const FEATURES: string[] = [
  "First voice assistant built to integrate with Home Assistant",
  "Open source and privacy-focused — no cloud lock-in",
  "Advanced on-device audio processing",
  "Premium design that blends into the home",
  "Seamless control of your local smart home",
  "Works with Home Assistant Green and existing setups",
];

const DESCRIPTION = `<p>The Home Assistant Voice Preview Edition is the first voice assistant built to seamlessly integrate with Home Assistant. This open-source, privacy-focused device has advanced audio processing in a premium design that blends into the home.</p>
<p>Control your smart home by voice without sending recordings to the cloud. Runs locally with your Home Assistant instance for full privacy and reliability.</p>`;

export const HOME_ASSISTANT_VOICE = {
  id: PRODUCT_ID,
  name: "Home Assistant Voice Preview Edition",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
  mainImageAlt: "Home Assistant Voice Preview Edition - privacy-focused voice assistant for Home Assistant",
  mainImageTitle: "Home Assistant Voice Preview Edition | Seeed Studio",
  priceCents: PRICE_CENTS,
  costPerItemCents: PRICE_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Seeed Studio",
  model: "Voice Preview Edition",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription:
    "Home Assistant Voice Preview Edition: open-source voice assistant for Home Assistant. Privacy-focused, local audio. Seeed Studio. Buy at Culture.",
  pageTitle: "Home Assistant Voice Preview Edition | Voice Assistant | Culture",
  sku: "110992044",
  hasVariants: false,
  continueSellingWhenOutOfStock: true,
  pageLayout: "long-form" as const,
  images: PRODUCT_IMAGES,
};
