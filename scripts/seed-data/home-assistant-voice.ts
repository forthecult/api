/**
 * Seed data for Home Assistant Voice Preview Edition — voice assistant for Home Assistant.
 * Sourced from Seeed Studio (US warehouse). Brand: Seeed Studio. Category: Smart Home. US price: $59.00.
 *
 * IMAGES: We do not use Seeed's CDN. The URLs below are SOURCE ONLY for the upload script.
 * Run db:upload-curated-product-images after seeding so images are hosted on UploadThing (our CDN), not Seeed.
 *
 * Markets: Seeed US warehouse ships USA only; we restrict to US.
 */

const PRICE_CENTS = 5900; // US $59.00
const PRODUCT_ID = "home-assistant-voice";
const PRODUCT_SLUG = "home-assistant-voice";
const CATEGORY_ID = "smart-home";

/** Source URLs only—upload script fetches from here and hosts on UploadThing. We do not serve Seeed CDN. */
const SEEED_CACHE =
  "https://media-cdn.seeedstudio.com/media/catalog/product/cache/1/image/1200x1200/9df78eab33525d08d6e5fb8d27136e95";

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  {
    url: `${SEEED_CACHE}/h/o/home_assitant_voice.jpg`,
    alt: "Home Assistant Voice Preview Edition - voice assistant for Home Assistant",
    title: "Home Assistant Voice - Main",
  },
  {
    url: `${SEEED_CACHE}/v/o/voice_preview_edition_-_device_-_5._top.png`,
    alt: "Home Assistant Voice - top view",
    title: "Home Assistant Voice - Top",
  },
  {
    url: `${SEEED_CACHE}/v/o/voice_preview_edition_-_device_-_7._front.png`,
    alt: "Home Assistant Voice - front",
    title: "Home Assistant Voice - Front",
  },
  {
    url: `${SEEED_CACHE}/v/o/voice_preview_edition_-_device_-_8._back.png`,
    alt: "Home Assistant Voice - back",
    title: "Home Assistant Voice - Back",
  },
  {
    url: `${SEEED_CACHE}/v/o/voice_preview_edition_-_packaging_-_4._open_with_contents.png`,
    alt: "Home Assistant Voice - packaging and contents",
    title: "Home Assistant Voice - Contents",
  },
];

const FEATURES: string[] = [
  "First voice assistant designed for Home Assistant; runs locally",
  "Open source and privacy-first—no cloud lock-in, no sending recordings away",
  "On-device audio processing; control lights, scenes, and automations by voice",
  "Pairs with Home Assistant Green or any existing Home Assistant setup",
  "Discreet design that fits into the room",
];

const DESCRIPTION = `<p>Voice Preview Edition is the first voice assistant built for Home Assistant. Ask it to turn off the lights, run a scene, or trigger an automation—all without leaving your couch. Processing happens on the device and in your Home Assistant instance, so your voice stays in your home. No required cloud account and no shipping recordings to third parties.</p>

<p>It works with Home Assistant Green or any existing Home Assistant install. Set it up in the same dashboard you use for the rest of your smart home. Open source means you can see how it works and the community can improve it over time.</p>

<p>If you’ve wanted voice control without handing data to big tech, this is built for that.</p>`;

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
  /** US only. Images must be on UploadThing (run db:upload-curated-product-images)—we do not use Seeed CDN. */
  availableCountryCodes: ["US"] as const,
};
