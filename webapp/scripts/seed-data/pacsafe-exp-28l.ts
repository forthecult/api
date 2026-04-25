/**
 * Seed data for Pacsafe® EXP 28L Anti-Theft Backpack.
 * Sourced from https://pacsafe.com/products/pacsafe-exp-28l-anti-theft-backpack
 * Price set 4% above cost ($229.95 cost → $239.15 sell). Brand: Pacsafe. Category: Backpacks.
 * Pacsafe list price = our cost (costPerItemCents); we do not show compare-at.
 */

const LIST_PRICE_USD = 229.95;
const PRICE_MARKUP = 1.04;
/** Our cost (Pacsafe list price). */
export const PACSAFE_EXP_28L_COST_CENTS = Math.round(LIST_PRICE_USD * 100);
export const PACSAFE_EXP_28L_PRICE_CENTS = Math.round(
  LIST_PRICE_USD * PRICE_MARKUP * 100,
);

/** Base CDN URL for product images (Shopify CDN). */
const CDN = "https://cdn.shopify.com/s/files/1/0041/7638/0013/files";

/** Product ID and slug for URLs and DB. */
export const PRODUCT_ID = "pacsafe-exp-28l";
export const PRODUCT_SLUG = "pacsafe-exp-28l-anti-theft-backpack";
export const CATEGORY_ID = "accessories-backpacks";

/** SEO-friendly image entries: url, alt, title (custom names and metadata). */
export const PRODUCT_IMAGES: Array<{
  url: string;
  alt: string;
  title: string;
}> = [
  {
    url: `${CDN}/PacsafeEXP_28LBackpack_60314100_Black_01.jpg?v=1769879540`,
    alt: "Pacsafe EXP 28L Anti-Theft Backpack front view, Black - 28 liter travel backpack",
    title: "Pacsafe EXP 28L Anti-Theft Backpack - Main view",
  },
  {
    url: `${CDN}/SecondaryThumbnail_EXP28TravelBackpack_f37d98a6-b0e7-48ae-892f-c429835978f6.jpg?v=1769879540`,
    alt: "Pacsafe EXP 28L backpack lifestyle shot - compact anti-theft travel bag",
    title: "Pacsafe EXP 28L - Travel and commute",
  },
  {
    url: `${CDN}/PacsafeEXP_28LBackpack_60314100_Black_02.jpg?v=1769879540`,
    alt: "Pacsafe EXP 28L backpack side angle - slash-proof straps and zippers",
    title: "Pacsafe EXP 28L - Side profile",
  },
  {
    url: `${CDN}/PacsafeEXP_28LBackpack_60314100_Black_03.jpg?v=1769879540`,
    alt: "Pacsafe EXP 28L Anti-Theft Backpack back panel and laptop sleeve",
    title: "Pacsafe EXP 28L - Back panel and laptop compartment",
  },
  {
    url: `${CDN}/PacsafeEXP_28LBackpack_60314100_Black_04.jpg?v=1769879540`,
    alt: "Pacsafe EXP 28L backpack interior organization and pockets",
    title: "Pacsafe EXP 28L - Interior organization",
  },
  {
    url: `${CDN}/PacsafeEXP_28LBackpack_60314100_Black_07.jpg?v=1769879540`,
    alt: "Pacsafe EXP 28L anti-theft features - Roobar lock and ToughZip",
    title: "Pacsafe EXP 28L - Security details",
  },
  {
    url: `${CDN}/PacsafeEXP_28LBackpack_60314100_Black_05.jpg?v=1769879540`,
    alt: "Pacsafe EXP 28L backpack carry handle and luggage slip",
    title: "Pacsafe EXP 28L - Top handle and luggage pass-through",
  },
  {
    url: `${CDN}/PacsafeEXP_28LBackpack_60314100_Black_06.jpg?v=1769879540`,
    alt: "Pacsafe EXP 28L Black - water bottle pocket and side profile",
    title: "Pacsafe EXP 28L - Side pockets",
  },
];

/** Key features (4–5 bullets; rest in description). */
export const FEATURES: string[] = [
  "Roobar™ Deluxe locking system and puncture-resistant ToughZip for serious theft deterrence",
  "RFIDsafe® blocking pockets and Carrysafe® slashguard straps with Dyneema®",
  'Fits 16" MacBook Pro in padded sleeve; luggage slip for wheeled bags',
  "Dual carry: wear as backpack or grab as duffel via center handle",
  "Made with recycled PET (rPET)—equivalent to 32 plastic bottles; PFC-free water repellent",
];

/** Full product description (rewritten for Culture; specs and details). */
export const DESCRIPTION = `<p>The EXP 28L is built for commuters and weekend travelers who want one bag that does it all: secure, organized, and ready to go. A lockable hidden laptop compartment fits most 16" laptops, while internal pockets keep phone, pens, and keys in place. Use the luggage slip to slide the bag onto wheeled luggage or carry it by the central grab handle when you're in a rush.</p>

<p>Security is front and center. Self-locking zippers, PopNLock clip, and eXomesh slashguard work together so your gear stays yours. The shell and lining are 750D and 150D recycled polyester with 1000mm water resistance and no PFCs—tough and sustainable.</p>

<h2>Specifications</h2>
<ul>
<li><strong>Volume:</strong> 28 L</li>
<li><strong>Dimensions:</strong> 19.7 × 11.2 × 7.5 in</li>
<li><strong>Weight:</strong> 2.4 lb (1.09 kg)</li>
<li><strong>Materials:</strong> 750D/150D rPET, PFC-free</li>
</ul>

<p>Pacsafe backs this bag with a 5-year limited warranty.</p>`;

/** Meta description for SEO. */
export const META_DESCRIPTION =
  "Pacsafe EXP 28L Anti-Theft Backpack—28L compact travel backpack with RFID blocking, slash-proof straps, ToughZip, and Roobar lock. Recycled materials. Shop at Culture.";

/** Page title for SEO. */
export const PAGE_TITLE =
  "Pacsafe EXP 28L Anti-Theft Backpack | 28L Travel Backpack | Culture";

/** Main product image alt (SEO). */
export const MAIN_IMAGE_ALT =
  "Pacsafe EXP 28L Anti-Theft Backpack front view, Black - 28 liter compact travel backpack with laptop sleeve";

/** Main product image title (SEO). */
export const MAIN_IMAGE_TITLE =
  "Pacsafe EXP 28L Anti-Theft Backpack - 28L Anti-Theft Travel Backpack";

/** Option definition for variant selector (Color). */
export const OPTION_DEFINITIONS = [
  { name: "Color", values: ["Black", "Slate"] },
];

/** Variants: Black and Slate. Same price (5% above list); each has its own SKU and image. */
export const VARIANTS: Array<{
  id: string;
  color: string;
  priceCents: number;
  sku: string;
  imageUrl: string;
  imageAlt: string;
  imageTitle: string;
}> = [
  {
    id: `${PRODUCT_ID}-black`,
    color: "Black",
    priceCents: PACSAFE_EXP_28L_PRICE_CENTS,
    sku: "60314100",
    imageUrl: `${CDN}/PacsafeEXP_28LBackpack_60314100_Black_01.jpg?v=1769879540`,
    imageAlt: "Pacsafe EXP 28L Anti-Theft Backpack, Black - front view",
    imageTitle: "Pacsafe EXP 28L Anti-Theft Backpack - Black",
  },
  {
    id: `${PRODUCT_ID}-slate`,
    color: "Slate",
    priceCents: PACSAFE_EXP_28L_PRICE_CENTS,
    sku: "60314144",
    imageUrl: `${CDN}/PacsafeEXP_28LBackpack_60314144_Slate_01.jpg?v=1769879540`,
    imageAlt: "Pacsafe EXP 28L Anti-Theft Backpack, Slate - front view",
    imageTitle: "Pacsafe EXP 28L Anti-Theft Backpack - Slate",
  },
];

export const PACSAFE_EXP_28L = {
  id: PRODUCT_ID,
  name: "Pacsafe® EXP 28L Anti-Theft Backpack",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
  mainImageAlt: MAIN_IMAGE_ALT,
  mainImageTitle: MAIN_IMAGE_TITLE,
  priceCents: PACSAFE_EXP_28L_PRICE_CENTS,
  costPerItemCents: PACSAFE_EXP_28L_COST_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Pacsafe",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription: META_DESCRIPTION,
  pageTitle: PAGE_TITLE,
  sku: "60314100",
  weightGrams: 1090,
  weightUnit: "lb" as const,
  images: PRODUCT_IMAGES,
  hasVariants: true,
  optionDefinitions: OPTION_DEFINITIONS,
  variants: VARIANTS,
  /** North America store: US & Canada only (pacsafe.com/pages/shipping). */
  availableCountryCodes: ["US", "CA"] as const,
};
