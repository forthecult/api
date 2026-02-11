/**
 * Seed data for Minirig 4 Bluetooth Speaker.
 * Sourced from https://minirigs.co.uk/speakers/bluetooth-minirig-4
 * Price: £169.95 (≈ $215 USD). Brand: Minirig. Category: Speakers.
 * Ships 1–5 working days. UK/US shipping via seed-shipping-by-brand (minirig).
 */

const PRICE_USD = 214.99; // £169.95 ≈ $215
export const MINIRIG_4_PRICE_CENTS = Math.round(PRICE_USD * 100);

const PRODUCT_ID = "minirig-4";
const PRODUCT_SLUG = "minirig-4-bluetooth-speaker";
const CATEGORY_ID = "accessories-speakers";

const SITES_LARGE = "https://minirigs.co.uk/sites/default/files/styles/large/public/2026-01";

/** Product photos from minirigs.co.uk (not logos). One per angle / accessory. */
export const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  {
    url: `${SITES_LARGE}/minirig-4-black.webp?itok=Sz1POk6h`,
    alt: "Minirig 4 Bluetooth Speaker Black - portable wireless speaker, designed in Bristol UK",
    title: "Minirig 4 Bluetooth Speaker - Black",
  },
  {
    url: `${SITES_LARGE}/minirig-4-black-top-cap.webp?itok=2YpnK93c`,
    alt: "Minirig 4 Black grille and top cap",
    title: "Minirig 4 - Grille",
  },
  {
    url: `${SITES_LARGE}/minirig-4-bottom-cap.webp?itok=w5op-ysf`,
    alt: "Minirig 4 bottom cap and controls",
    title: "Minirig 4 - Bottom",
  },
  {
    url: `${SITES_LARGE}/minirig-4-case-open.webp?itok=Sh4PRn1k`,
    alt: "Minirig 4 with protective travel case open",
    title: "Minirig 4 - Case open",
  },
  {
    url: `${SITES_LARGE}/minirig-4-case-closed.webp?itok=SedEPEDw`,
    alt: "Minirig 4 travel case closed",
    title: "Minirig 4 - Case closed",
  },
  {
    url: `${SITES_LARGE}/minirig-4-charger-cable.webp?itok=hnH4dDPD`,
    alt: "Minirig 4 USB-C charging cable",
    title: "Minirig 4 - Charger cable",
  },
  {
    url: `${SITES_LARGE}/minirig-4-packaging.webp?itok=Oa2kYqSz`,
    alt: "Minirig 4 eco-friendly recycled packaging",
    title: "Minirig 4 - Packaging",
  },
];

export const FEATURES: string[] = [
  "Custom 70mm driver with neodymium magnet — crisp, clear, powerful sound",
  "Up to 100 hours playtime (low volume); 30h average; fast USB-C charge in 2 hours",
  "Bluetooth 5.0 with AAC, linkup mode & wireless stereo; 10–30 m range",
  "USB-C Power Delivery, powerbank function; 3.5mm in/out; splash resistant",
  "Designed and made in Bristol, UK; anodised aluminium and ABS; 563 g",
];

export const DESCRIPTION = `<p>The Minirig 4 is the loudest small speaker in its class—designed and built in Bristol, UK. Rich clarity, balanced audio, and up to 100 hours of playtime on a single charge. Link multiple Minirig 4s wirelessly for a modular sound system.</p>

<p>Bluetooth 5.0 with AAC, hands-free calling, linkup mode, and wireless stereo. USB-C fast charging (2 hours) and powerbank function. VU LED control and the Minirig App for customisation. Splash resistant; built to last and easy to repair.</p>

<h2>Specifications</h2>
<ul>
<li><strong>Dimensions:</strong> 101.6 × 73 mm</li>
<li><strong>Weight:</strong> 563 g</li>
<li><strong>Driver:</strong> Custom 70 mm with neodymium magnet</li>
<li><strong>Frequency response:</strong> 60 Hz – 18 kHz</li>
<li><strong>Battery:</strong> 5 h (max volume) – 100 h (low); USB-C PD 2 h charge</li>
<li><strong>Amplifier:</strong> 1 × 50 W RMS</li>
<li><strong>Bluetooth:</strong> 5.0, AAC, linkup, stereo; receiver mode; 2 × 3.5 mm jack</li>
</ul>

<h2>In the box</h2>
<p>Minirig 4 Bluetooth Speaker, USB-C charging cable, high-quality audio cable, protective travel case, eco-friendly recycled packaging.</p>`;

export const META_DESCRIPTION =
  "Minirig 4 Bluetooth Speaker — portable, UK-made, up to 100h playtime, Bluetooth 5.0, linkup & stereo. Loudest small speaker. Shop at Culture.";

export const PAGE_TITLE =
  "Minirig 4 Bluetooth Speaker | Portable Wireless Speaker | Culture";

export const MAIN_IMAGE_ALT =
  "Minirig 4 Bluetooth Speaker - portable wireless speaker, Bristol UK";

export const MAIN_IMAGE_TITLE = "Minirig 4 Bluetooth Speaker | Portable Bluetooth Speaker";

export const OPTION_DEFINITIONS = [
  { name: "Colour", values: ["Black", "Blue", "Brushed Silver", "Green", "Red"] },
];

const COLOURS = ["Black", "Blue", "Brushed Silver", "Green", "Red"] as const;

/** Photo of each colour variant from minirigs.co.uk (one image per variant). */
const VARIANT_IMAGE_URLS: Record<(typeof COLOURS)[number], string> = {
  Black: `${SITES_LARGE}/minirig-4-black.webp?itok=Sz1POk6h`,
  Blue: `${SITES_LARGE}/minirig-4-blue.webp?itok=s7BbIhfE`,
  "Brushed Silver": `${SITES_LARGE}/minirig-4-brushed-silver.webp?itok=00TzdmUL`,
  Green: `${SITES_LARGE}/minirig-4-green.webp?itok=gik6ylsA`,
  Red: `${SITES_LARGE}/minirig-4-red.webp?itok=A4ATy2Gb`,
};

export const VARIANTS: Array<{
  id: string;
  color: string;
  priceCents: number;
  sku: string;
  imageUrl: string;
  imageAlt: string;
  imageTitle: string;
}> = COLOURS.map((colour) => ({
  id: `${PRODUCT_ID}-${colour.toLowerCase().replace(/\s+/g, "-")}`,
  color: colour,
  priceCents: MINIRIG_4_PRICE_CENTS,
  sku: `MINIRIG4-${colour.replace(/\s+/, "").slice(0, 6).toUpperCase()}`,
  imageUrl: VARIANT_IMAGE_URLS[colour],
  imageAlt: `Minirig 4 Bluetooth Speaker, ${colour}`,
  imageTitle: `Minirig 4 - ${colour}`,
}));

export const MINIRIG_4 = {
  id: PRODUCT_ID,
  name: "Minirig 4 Bluetooth Speaker",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
  mainImageAlt: MAIN_IMAGE_ALT,
  mainImageTitle: MAIN_IMAGE_TITLE,
  priceCents: MINIRIG_4_PRICE_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Minirig",
  vendor: "Minirig",
  countryOfOrigin: "United Kingdom",
  model: "Minirig 4",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription: META_DESCRIPTION,
  pageTitle: PAGE_TITLE,
  sku: "MINIRIG4-BLACK",
  weightGrams: 563,
  weightUnit: "g" as const,
  images: PRODUCT_IMAGES,
  hasVariants: true,
  optionDefinitions: OPTION_DEFINITIONS,
  variants: VARIANTS,
  handlingDaysMin: 1,
  handlingDaysMax: 5,
  /** Minirig ships UK & US; shipping rules in seed-shipping-by-brand (minirig). */
  availableCountryCodes: ["GB", "US"] as const,
};
