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
  "Lockable hidden back compartment fits 16\" MacBook Pro in padded sleeve",
  "RFIDsafe® blocking and Roobar™ Sport lock for cards and bag security",
  "Quick-access strap pocket for AirPods or transit card; hidden back pocket",
  "Slim 20L profile with sternum strap and hip belt; luggage slip included",
  "Recycled PET (rPET), PFC-free water repellent—equivalent to 25 plastic bottles",
];

const DESCRIPTION = `<p>Urban carry without the bulk. The V 20L keeps your laptop in a lockable hidden back compartment, so it's out of sight and harder to grab. Inside, an admin layout gives you a phone pocket, pen pocket, zipper mesh, and RFID-blocking slot for passport and cards. Two front stash pockets and a hidden back pocket round out quick access.</p>

<p>Shoulder strap has a small zipper pocket for transit cards or earbuds. Carrysafe® slashguard and eXomesh® help protect against slash-and-grab; PopNLock and secure dock lock add another layer. Shell and lining are 750D and 150D recycled polyester, 1000mm water resistant, PFC-free.</p>

<h2>Specifications</h2>
<ul>
<li><strong>Volume:</strong> 20 L · <strong>Weight:</strong> 2.14 lb (970 g)</li>
<li><strong>Dimensions:</strong> 17.7 × 11 × 5.7 in</li>
</ul>

<p>5-year limited warranty.</p>`;

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
