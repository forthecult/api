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
const CDN =
  "https://cdn.shopify.com/s/files/1/0041/7638/0013/files";

/** Product ID and slug for URLs and DB. */
export const PRODUCT_ID = "pacsafe-exp-28l";
export const PRODUCT_SLUG = "pacsafe-exp-28l-anti-theft-backpack";
export const CATEGORY_ID = "accessories-backpacks";

/** SEO-friendly image entries: url, alt, title (custom names and metadata). */
export const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
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

/** Key features (bullet list on product page). */
export const FEATURES: string[] = [
  "Made with post-consumer recycled PET (rPET)—equivalent to 32 recycled plastic bottles",
  "PFC-free water-repellent shell fabric (1000mm water resistant)",
  "Dual carry: backpack or duffel via centrally located grab handle",
  "Fits 16\" MacBook Pro and most 16\" laptops in padded sleeve",
  "Luggage slip slides over wheeled bag handles for balanced carry",
  "Adjustable sternum strap for comfort",
  "Internal pockets: designated phone and pen pockets for organization",
  "Two side pockets for water bottle or small umbrella",
  "Internal attachment point for wallets and keys",
  "External attachment points for pouches, locks, or rain covers",
  "RFIDsafe® blocking pockets and material",
  "PopNLock security clip",
  "Self-locking zippers",
  "Carrysafe® slashguard strap with Dyneema®",
  "eXomesh® slashguard (embroidered method)",
  "Roobar™ Deluxe locking system",
  "Interlocking zip pullers",
  "Puncture-resistant ToughZip",
];

/** Full product description (plain text + specs; description accordion). */
export const DESCRIPTION = `The Pacsafe EXP 28L Backpack caters to commuters, city explorers, and quick getaway seekers, emphasizing security, functionality, and comfort in a compact design. Advanced anti-theft features such as self-locking zippers, ToughZip technology, and an RFID-blocking pocket for digital security help offer travelers the peace of mind they deserve. The backpack facilitates easy organization with a spacious main compartment, padded laptop sleeve, and quick-access pockets. It ensures seamless transitions and versatility with a luggage slip and durable handles, allowing travelers to carry it like a duffel bag. By combining advanced security features, effortless organization, and comfortable functionality, the Pacsafe EXP 28L Backpack is an ideal choice for travelers seeking peace of mind, organization, and convenience on their journeys.

This product is made with post-consumer recycled polyester (rPET), equivalent to 32 recycled plastic bottles, and is treated with 100% PFC-free water repellency.


SPECIFICATIONS

Volume: 28 L
Height: 19.7 in
Width: 11.2 in
Depth: 7.5 in
Weight: 2.4 lb (1.09 kg)
Crossbody circumference (max–min): 42.1–52.0 in
Backpack strap length (max–min): 26.4–36.2 in


MATERIALS

Shell: 750D recycled polyester, 1000mm water resistant, PFC-free.
Lining: 150D recycled polyester, 1000mm water resistant, PFC-free.
Sustainable materials: Recycled polyester (rPET).


WARRANTY

Pacsafe offers a limited 5-year warranty on backpacks and bags.`;

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
export const OPTION_DEFINITIONS = [{ name: "Color", values: ["Black", "Slate"] }];

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
};
