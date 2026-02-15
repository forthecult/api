/**
 * Seed data for Minirig Subwoofer 4.
 * Sourced from https://minirigs.co.uk/speakers/minirig-subwoofer-4
 * Price: £179.95 (≈ $228 USD). Brand: Minirig. Category: Speakers.
 * Must be used with Minirig or Minirig Mini. Ships 1–5 working days.
 */

const PRICE_USD = 227.99; // £179.95 ≈ $228
export const MINIRIG_SUBWOOFER_4_PRICE_CENTS = Math.round(PRICE_USD * 100);

const PRODUCT_ID = "minirig-subwoofer-4";
const PRODUCT_SLUG = "minirig-subwoofer-4";
const CATEGORY_ID = "accessories-speakers";

const SITES_LARGE_2025_12 =
  "https://minirigs.co.uk/sites/default/files/styles/large/public/2025-12";
const SITES_LARGE_2025_11 =
  "https://minirigs.co.uk/sites/default/files/styles/large/public/2025-11";

/** Product photos from minirigs.co.uk (not logos). */
export const PRODUCT_IMAGES: Array<{
  url: string;
  alt: string;
  title: string;
}> = [
  {
    url: `${SITES_LARGE_2025_12}/black-sub-4.webp?itok=6EtSzO36`,
    alt: "Minirig Subwoofer 4 Black - portable wireless subwoofer, Bristol UK",
    title: "Minirig Subwoofer 4 - Black",
  },
  {
    url: `${SITES_LARGE_2025_12}/topview-black-sub-4.webp?itok=UQ1Hvnfd`,
    alt: "Minirig Subwoofer 4 grille top view",
    title: "Minirig Subwoofer 4 - Grille",
  },
  {
    url: `${SITES_LARGE_2025_12}/port-view-sub-4.webp?itok=wns2zoI6`,
    alt: "Minirig Subwoofer 4 port view",
    title: "Minirig Subwoofer 4 - Port",
  },
  {
    url: `${SITES_LARGE_2025_12}/Subwoofer%204%20-%20product%20-%20Mailchimp%20%281%29.png.webp?itok=QxwBrvw4`,
    alt: "Minirig Subwoofer 4 in the box",
    title: "Minirig Subwoofer 4 - In the box",
  },
];

export const FEATURES: string[] = [
  "Custom 74 mm high-excursion driver, double neodymium — 38 Hz–150 Hz deep bass",
  "Link wirelessly to multiple Minirig 4 speakers and Subwoofer 4s; modular system",
  "33.3 Wh battery; up to 100 h (low), 40 h average; USB-C fast charge 2 h",
  "Bluetooth 5.0, AAC; 20–40 m range; app control for gain and EQ",
  "Designed and made in Bristol, UK; 1-year warranty, dedicated repair process",
];

export const DESCRIPTION = `<p>Minirig Subwoofer 4 delivers powerful deep bass you can hear and feel—in the smallest portable subwoofer form. Link it wirelessly to Minirig 4 or Minirig Mini 2 to build a complete modular sound system with no cables.</p>

<p>Years of R&D went into the custom 3-inch double neodymium driver and 33.3 Wh battery. USB-C charging, full app control for gain and EQ, and the same build quality as the rest of the Minirig range. Must be used with a Minirig or Minirig Mini; not standalone.</p>

<h2>Specifications</h2>
<ul>
<li><strong>Dimensions:</strong> 101.6 × 219 mm</li>
<li><strong>Weight:</strong> 1051 g</li>
<li><strong>Driver:</strong> Custom 74 mm high-excursion, double neodymium</li>
<li><strong>Frequency response:</strong> 38 Hz – 150 Hz</li>
<li><strong>Battery:</strong> 6 h (max) – 100 h (low); USB-C PD 2 h charge</li>
<li><strong>Amplifier:</strong> 1 × 50 W RMS</li>
<li><strong>Bluetooth:</strong> 5.0, AAC, linkup, stereo; 2 × 3.5 mm jack</li>
</ul>

<h2>In the box</h2>
<p>Minirig Subwoofer 4, USB-C charging cable, high-quality audio cable, protective travel case, eco-friendly recycled packaging.</p>`;

export const META_DESCRIPTION =
  "Minirig Subwoofer 4 — portable wireless subwoofer, UK-made, link with Minirig 4 wirelessly. Deep bass, modular system. Shop at Culture.";

export const PAGE_TITLE =
  "Minirig Subwoofer 4 | Portable Wireless Subwoofer | Culture";

export const MAIN_IMAGE_ALT =
  "Minirig Subwoofer 4 - portable wireless subwoofer, Bristol UK";

export const MAIN_IMAGE_TITLE = "Minirig Subwoofer 4 | Portable Subwoofer";

export const OPTION_DEFINITIONS = [
  {
    name: "Colour",
    values: ["Black", "Blue", "Brushed Silver", "Green", "Purple", "Red"],
  },
];

const COLOURS = [
  "Black",
  "Blue",
  "Brushed Silver",
  "Green",
  "Purple",
  "Red",
] as const;

/** Photo of each colour variant from minirigs.co.uk (one image per variant). */
const VARIANT_IMAGE_URLS: Record<(typeof COLOURS)[number], string> = {
  Black: `${SITES_LARGE_2025_11}/black-sub-4.webp?itok=2LnqDOgl`,
  Blue: `${SITES_LARGE_2025_11}/blue-sub-4.webp?itok=4-NXIT3T`,
  "Brushed Silver": `${SITES_LARGE_2025_11}/brushed-sub-4.webp?itok=P5nxiI7f`,
  Green: `${SITES_LARGE_2025_11}/green-sub-4.webp?itok=MVoTu7Mx`,
  Purple: `${SITES_LARGE_2025_11}/purple-sub-4.webp?itok=1WQ879_q`,
  Red: `${SITES_LARGE_2025_11}/red-sub-4.webp?itok=Ac7_xGHj`,
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
  priceCents: MINIRIG_SUBWOOFER_4_PRICE_CENTS,
  sku: `MINIRIGSUB4-${colour.replace(/\s+/, "").slice(0, 6).toUpperCase()}`,
  imageUrl: VARIANT_IMAGE_URLS[colour],
  imageAlt: `Minirig Subwoofer 4, ${colour}`,
  imageTitle: `Minirig Subwoofer 4 - ${colour}`,
}));

export const MINIRIG_SUBWOOFER_4 = {
  id: PRODUCT_ID,
  name: "Minirig Subwoofer 4",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
  mainImageAlt: MAIN_IMAGE_ALT,
  mainImageTitle: MAIN_IMAGE_TITLE,
  priceCents: MINIRIG_SUBWOOFER_4_PRICE_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Minirig",
  vendor: "Minirig",
  countryOfOrigin: "United Kingdom",
  model: "Subwoofer 4",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription: META_DESCRIPTION,
  pageTitle: PAGE_TITLE,
  sku: "MINIRIGSUB4-BLACK",
  weightGrams: 1051,
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
