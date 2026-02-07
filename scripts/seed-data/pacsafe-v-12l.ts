/**
 * Seed data for Pacsafe® V 12L Anti-Theft Tech Backpack.
 * Sourced from https://pacsafe.com/products/pacsafe-v-12l-anti-theft-tech-backpack
 * Pacsafe list price = our cost; sell at 4% above ($149.95 → $155.95). Brand: Pacsafe. Category: Bags.
 */

const LIST_PRICE_USD = 149.95;
const PRICE_MARKUP = 1.04;
const COST_CENTS = Math.round(LIST_PRICE_USD * 100);
const PRICE_CENTS = Math.round(LIST_PRICE_USD * PRICE_MARKUP * 100);

const CDN = "https://cdn.shopify.com/s/files/1/0041/7638/0013/files";

const PRODUCT_ID = "pacsafe-v-12l";
const PRODUCT_SLUG = "pacsafe-v-12l-anti-theft-tech-backpack";
const CATEGORY_ID = "accessories-bags";

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  { url: `${CDN}/PacsafeV_12LTechBackpack_61140148_DigitalGray_01_8861f437-74e6-4ab9-8eec-89c67832b8a5.jpg?v=1769879522`, alt: "Pacsafe V 12L Anti-Theft Tech Backpack, Digital Gray - front view", title: "Pacsafe V 12L Tech Backpack - Main view" },
  { url: `${CDN}/SecondaryThumbnail_V_12LTechBackpack_ff7fc637-f64e-4506-ad1a-46679dbe171c.jpg?v=1769879522`, alt: "Pacsafe V 12L tech backpack compact anti-theft bag", title: "Pacsafe V 12L - Compact carry" },
  { url: `${CDN}/PacsafeV_12LTechBackpack_61140148_DigitalGray_02_581859dc-6821-42b5-ae77-774520b1bc3f.jpg?v=1769879522`, alt: "Pacsafe V 12L backpack side - tablet sleeve and organization", title: "Pacsafe V 12L - Side view" },
  { url: `${CDN}/PacsafeV_12LTechBackpack_61140148_DigitalGray_03_652d3ff1-12e3-4f56-973c-52a9a83c89a9.jpg?v=1769879522`, alt: "Pacsafe V 12L anti-theft tech backpack back panel", title: "Pacsafe V 12L - Back panel" },
  { url: `${CDN}/PacsafeV_12LTechBackpack_61140148_DigitalGray_04_bd0cd710-6ac1-4627-ad62-63919da03363.jpg?v=1769879522`, alt: "Pacsafe V 12L interior mesh pockets and tablet sleeve", title: "Pacsafe V 12L - Interior" },
  { url: `${CDN}/PacsafeV_12LTechBackpack_61140148_DigitalGray_05_71cd6be7-b40c-426d-9bff-e4c815de1cee.jpg?v=1769879522`, alt: "Pacsafe V 12L security features Roobar Sport", title: "Pacsafe V 12L - Security details" },
];

const FEATURES: string[] = [
  "Made with post-consumer recycled PET (rPET)—equivalent to 14 recycled plastic bottles",
  "PFC-free water-repellent shell fabric",
  "Fits iPad Pro 11\" and most 11\" tablets in padded sleeve",
  "Tablet sleeve doubles as hydration pack system",
  "Adjustable sternum strap and hip belt for comfort",
  "External attachment points on shoulder straps for pouches, locks, or rain covers",
  "Two side pockets for water bottle or small umbrella",
  "Internal pockets: phone pocket, pen pocket; internal attachment for wallets and keys",
  "RFIDsafe® blocking pockets and material",
  "PopNLock security clip",
  "Carrysafe® slashguard strap with Dyneema®",
  "eXomesh® slashguard (embroidered method)",
  "Roobar™ Sport locking system",
];

const DESCRIPTION = `This backpack keeps it convenient and practical with its taller profile and compact design, providing just the right amount of space for your must-haves without any extra bulk. You've got 12L of cleverly organized storage tailored to your tech gear, including a padded sleeve to fit an 11-inch tablet. The front compartment comes equipped with two mesh pockets, perfect for stashing chargers, cables, or any other accessories you need close at hand.

This product is made with post-consumer recycled polyester (rPET), equivalent to 14 recycled plastic bottles, and is treated with 100% PFC-free water repellency.

SPECIFICATIONS

Volume: 12 L
Height: 16.1 in
Width: 7.9 in
Depth: 5.1 in
Weight: 1.38 lb (620 g)
Crossbody circumference (max–min): 37.0–50.0 in
Backpack strap length (max–min): 23.2–36.2 in

MATERIALS

Shell: 750D recycled polyester, 1000mm water resistant, PFC-free.
Lining: 150D recycled polyester, 1000mm water resistant, PFC-free.
Sustainable materials: Recycled polyester (rPET).

WARRANTY

Pacsafe offers a limited 5-year warranty on backpacks and bags.`;

const OPTION_DEFINITIONS = [{ name: "Color", values: ["Digital Gray", "Beige", "Black"] }];

const VARIANTS: Array<{ id: string; color: string; priceCents: number; sku: string; imageUrl: string; imageAlt: string; imageTitle: string }> = [
  { id: `${PRODUCT_ID}-digital-gray`, color: "Digital Gray", priceCents: PRICE_CENTS, sku: "61140148", imageUrl: `${CDN}/PacsafeV_12LTechBackpack_61140148_DigitalGray_01_8861f437-74e6-4ab9-8eec-89c67832b8a5.jpg?v=1769879522`, imageAlt: "Pacsafe V 12L Anti-Theft Tech Backpack, Digital Gray", imageTitle: "Pacsafe V 12L Tech Backpack - Digital Gray" },
  { id: `${PRODUCT_ID}-beige`, color: "Beige", priceCents: PRICE_CENTS, sku: "61140237", imageUrl: `${CDN}/PacsafeV_12LTechBackpack_61140237_Beige_01.jpg?v=1769879522`, imageAlt: "Pacsafe V 12L Anti-Theft Tech Backpack, Beige", imageTitle: "Pacsafe V 12L Tech Backpack - Beige" },
  { id: `${PRODUCT_ID}-black`, color: "Black", priceCents: PRICE_CENTS, sku: "61140100", imageUrl: `${CDN}/PacsafeV_12LTechBackpack_61140100_Black_01.jpg?v=1769879522`, imageAlt: "Pacsafe V 12L Anti-Theft Tech Backpack, Black", imageTitle: "Pacsafe V 12L Tech Backpack - Black" },
];

export const PACSAFE_V_12L = {
  id: PRODUCT_ID,
  name: "Pacsafe® V 12L Anti-Theft Tech Backpack",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
  mainImageAlt: "Pacsafe V 12L Anti-Theft Tech Backpack, Digital Gray - 12L compact tech backpack",
  mainImageTitle: "Pacsafe V 12L Anti-Theft Tech Backpack - 12L Compact Backpack",
  priceCents: PRICE_CENTS,
  costPerItemCents: COST_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Pacsafe",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription: "Pacsafe V 12L Anti-Theft Tech Backpack—12L compact backpack for tablets and tech. RFID blocking, slashguard, Roobar Sport. Recycled materials. Shop at Culture.",
  pageTitle: "Pacsafe V 12L Anti-Theft Tech Backpack | 12L Tech Backpack | Culture",
  sku: "61140148",
  weightGrams: 620,
  weightUnit: "lb" as const,
  images: PRODUCT_IMAGES,
  hasVariants: true,
  optionDefinitions: OPTION_DEFINITIONS,
  variants: VARIANTS,
};
