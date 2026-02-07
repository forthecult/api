/**
 * Seed data for Pacsafe® V 20L Anti-Theft City Backpack.
 * Sourced from https://pacsafe.com/products/pacsafe-v-20l-anti-theft-city-backpack
 * Pacsafe list price = our cost; sell at 4% above ($179.95 → $187.15). Brand: Pacsafe. Category: Backpacks.
 */

const LIST_PRICE_USD = 179.95;
const PRICE_MARKUP = 1.04;
const COST_CENTS = Math.round(LIST_PRICE_USD * 100);
const PRICE_CENTS = Math.round(LIST_PRICE_USD * PRICE_MARKUP * 100);

const CDN = "https://cdn.shopify.com/s/files/1/0041/7638/0013/files";

const PRODUCT_ID = "pacsafe-v-20l";
const PRODUCT_SLUG = "pacsafe-v-20l-anti-theft-city-backpack";
const CATEGORY_ID = "accessories-backpacks";

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  { url: `${CDN}/PacsafeV_20LCityBackpack_61150148_DigitalGray_01.jpg?v=1769879931`, alt: "Pacsafe V 20L Anti-Theft City Backpack, Digital Gray - front view", title: "Pacsafe V 20L City Backpack - Main view" },
  { url: `${CDN}/SecondaryThumbnail_V_20LCityBackpack_8011d070-c64a-4e0f-8aed-4df4d8630c16.jpg?v=1769996518`, alt: "Pacsafe V 20L city backpack lifestyle - urban anti-theft bag", title: "Pacsafe V 20L - Urban carry" },
  { url: `${CDN}/PacsafeV_20LCityBackpack_61150148_DigitalGray_02.jpg?v=1769996518`, alt: "Pacsafe V 20L backpack side - organization and laptop sleeve", title: "Pacsafe V 20L - Side view" },
  { url: `${CDN}/PacsafeV_20LCityBackpack_61150148_DigitalGray_03.jpg?v=1769996518`, alt: "Pacsafe V 20L anti-theft city backpack back panel", title: "Pacsafe V 20L - Back panel" },
  { url: `${CDN}/PacsafeV_20LCityBackpack_61150148_DigitalGray_04.jpg?v=1769996518`, alt: "Pacsafe V 20L interior compartments and RFID pocket", title: "Pacsafe V 20L - Interior" },
  { url: `${CDN}/PacsafeV_20LCityBackpack_61150148_DigitalGray_05.jpg?v=1769996518`, alt: "Pacsafe V 20L hidden back pocket and security features", title: "Pacsafe V 20L - Security details" },
];

const FEATURES: string[] = [
  "Made with post-consumer recycled PET (rPET)—equivalent to 25 recycled plastic bottles",
  "PFC-free water-repellent shell fabric",
  "Quick-access zipper pocket on shoulder strap for AirPods and transit card",
  "Fits 16\" MacBook Pro and most 16\" laptops in lockable hidden back compartment with padded sleeve",
  "Luggage slip slides over wheeled bag handles for balanced carry",
  "Hidden back pocket for extra security",
  "Internal pockets: phone pocket, pen pocket, zipper mesh, RFID blocking pocket for passport and cards",
  "Two side pockets for water bottle or small umbrella",
  "Adjustable sternum strap and hip belt for comfort",
  "RFIDsafe® blocking pockets and material",
  "PopNLock security clip",
  "Secure dock lock",
  "Carrysafe® slashguard strap with Dyneema®",
  "eXomesh® slashguard (embroidered method)",
  "Roobar™ Sport locking system",
];

const DESCRIPTION = `Elevate your city adventures with this slimline backpack that offers multiple compartments for efficient organization, including two front stash compartments for quick access to smaller essentials. The main compartment boasts a padded laptop sleeve fit for a 16-inch MacBook Pro, accompanied by an admin section featuring a zipper mesh pocket, pen pocket, phone pocket, and an RFID blocking pocket for protecting your passport and cards. There's even a hidden back pocket, an extra hiding spot to securely store your other valuables.

This product is made with post-consumer recycled polyester (rPET), equivalent to 25 recycled plastic bottles, and is treated with 100% PFC-free water repellency.

SPECIFICATIONS

Volume: 20 L
Height: 17.7 in
Width: 11 in
Depth: 5.7 in
Weight: 2.14 lb (970 g)
Backpack strap length (max–min): 25.6–36.2 in
Crossbody circumference (max–min): 42.1–52.8 in

MATERIALS

Shell: 750D recycled polyester, 1000mm water resistant, PFC-free.
Lining: 150D recycled polyester, 1000mm water resistant, PFC-free.
Sustainable materials: Recycled polyester (rPET).

WARRANTY

Pacsafe offers a limited 5-year warranty on backpacks and bags.`;

const OPTION_DEFINITIONS = [{ name: "Color", values: ["Digital Gray", "Beige", "Black"] }];

const VARIANTS: Array<{ id: string; color: string; priceCents: number; sku: string; imageUrl: string; imageAlt: string; imageTitle: string }> = [
  { id: `${PRODUCT_ID}-digital-gray`, color: "Digital Gray", priceCents: PRICE_CENTS, sku: "61150148", imageUrl: `${CDN}/PacsafeV_20LCityBackpack_61150148_DigitalGray_01.jpg?v=1769879931`, imageAlt: "Pacsafe V 20L Anti-Theft City Backpack, Digital Gray", imageTitle: "Pacsafe V 20L City Backpack - Digital Gray" },
  { id: `${PRODUCT_ID}-beige`, color: "Beige", priceCents: PRICE_CENTS, sku: "61150237", imageUrl: `${CDN}/PacsafeV_20LCityBackpack_61150237_Beige_01.jpg?v=1769996518`, imageAlt: "Pacsafe V 20L Anti-Theft City Backpack, Beige", imageTitle: "Pacsafe V 20L City Backpack - Beige" },
  { id: `${PRODUCT_ID}-black`, color: "Black", priceCents: PRICE_CENTS, sku: "61150100", imageUrl: `${CDN}/PacsafeV_20LCityBackpack_61150100_Black_01.jpg?v=1769996518`, imageAlt: "Pacsafe V 20L Anti-Theft City Backpack, Black", imageTitle: "Pacsafe V 20L City Backpack - Black" },
];

export const PACSAFE_V_20L = {
  id: PRODUCT_ID,
  name: "Pacsafe® V 20L Anti-Theft City Backpack",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
  mainImageAlt: "Pacsafe V 20L Anti-Theft City Backpack, Digital Gray - 20L urban backpack with laptop sleeve",
  mainImageTitle: "Pacsafe V 20L Anti-Theft City Backpack - 20L Urban Backpack",
  priceCents: PRICE_CENTS,
  costPerItemCents: COST_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Pacsafe",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription: "Pacsafe V 20L Anti-Theft City Backpack—20L slimline urban backpack with RFID blocking, hidden back pocket, 16\" laptop sleeve. Recycled materials. Shop at Culture.",
  pageTitle: "Pacsafe V 20L Anti-Theft City Backpack | 20L Urban Backpack | Culture",
  sku: "61150148",
  weightGrams: 970,
  weightUnit: "lb" as const,
  images: PRODUCT_IMAGES,
  hasVariants: true,
  optionDefinitions: OPTION_DEFINITIONS,
  variants: VARIANTS,
  /** North America store: US & Canada only (pacsafe.com/pages/shipping). */
  availableCountryCodes: ["US", "CA"] as const,
};
