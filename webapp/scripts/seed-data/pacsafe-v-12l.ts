/**
 * Seed data for Pacsafe® V 12L Anti-Theft Tech Backpack.
 * Sourced from https://pacsafe.com/products/pacsafe-v-12l-anti-theft-tech-backpack
 * Pacsafe list price = our cost; sell at 4% above ($149.95 → $155.95). Brand: Pacsafe. Category: Backpacks.
 */

const LIST_PRICE_USD = 149.95;
const PRICE_MARKUP = 1.04;
const COST_CENTS = Math.round(LIST_PRICE_USD * 100);
const PRICE_CENTS = Math.round(LIST_PRICE_USD * PRICE_MARKUP * 100);

const CDN = "https://cdn.shopify.com/s/files/1/0041/7638/0013/files";

const PRODUCT_ID = "pacsafe-v-12l";
const PRODUCT_SLUG = "pacsafe-v-12l-anti-theft-tech-backpack";
const CATEGORY_ID = "accessories-backpacks";

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  {
    url: `${CDN}/PacsafeV_12LTechBackpack_61140148_DigitalGray_01_8861f437-74e6-4ab9-8eec-89c67832b8a5.jpg?v=1769879522`,
    alt: "Pacsafe V 12L Anti-Theft Tech Backpack, Digital Gray - front view",
    title: "Pacsafe V 12L Tech Backpack - Main view",
  },
  {
    url: `${CDN}/SecondaryThumbnail_V_12LTechBackpack_ff7fc637-f64e-4506-ad1a-46679dbe171c.jpg?v=1769879522`,
    alt: "Pacsafe V 12L tech backpack compact anti-theft bag",
    title: "Pacsafe V 12L - Compact carry",
  },
  {
    url: `${CDN}/PacsafeV_12LTechBackpack_61140148_DigitalGray_02_581859dc-6821-42b5-ae77-774520b1bc3f.jpg?v=1769879522`,
    alt: "Pacsafe V 12L backpack side - tablet sleeve and organization",
    title: "Pacsafe V 12L - Side view",
  },
  {
    url: `${CDN}/PacsafeV_12LTechBackpack_61140148_DigitalGray_03_652d3ff1-12e3-4f56-973c-52a9a83c89a9.jpg?v=1769879522`,
    alt: "Pacsafe V 12L anti-theft tech backpack back panel",
    title: "Pacsafe V 12L - Back panel",
  },
  {
    url: `${CDN}/PacsafeV_12LTechBackpack_61140148_DigitalGray_04_bd0cd710-6ac1-4627-ad62-63919da03363.jpg?v=1769879522`,
    alt: "Pacsafe V 12L interior mesh pockets and tablet sleeve",
    title: "Pacsafe V 12L - Interior",
  },
  {
    url: `${CDN}/PacsafeV_12LTechBackpack_61140148_DigitalGray_05_71cd6be7-b40c-426d-9bff-e4c815de1cee.jpg?v=1769879522`,
    alt: "Pacsafe V 12L security features Roobar Sport",
    title: "Pacsafe V 12L - Security details",
  },
];

const FEATURES: string[] = [
  '12L compact pack with padded sleeve for 11" tablet (e.g. iPad Pro)',
  "Roobar™ Sport lock, RFIDsafe® blocking, and slashguard straps",
  "Tablet sleeve doubles as hydration reservoir slot; two side pockets",
  "Phone and pen pockets, attachment points for keys and pouches",
  "Recycled PET (rPET), PFC-free—equivalent to 14 plastic bottles",
];

const DESCRIPTION = `<p>Minimal profile, max utility. The V 12L holds your tablet, daily tech, and a few extras without feeling like a full-size backpack. The main compartment has a padded sleeve that fits an 11" tablet and can double as a hydration reservoir slot. Up front, mesh pockets keep cables and small gear organized; inside you get phone and pen pockets plus an attachment point for keys.</p>

<p>Same Pacsafe DNA: Roobar Sport lock, PopNLock clip, Carrysafe® slashguard, eXomesh®, and RFID blocking. Sternum strap and hip belt are adjustable; shoulder straps have attachment points for pouches or a rain cover. Shell and lining are 750D/150D rPET, 1000mm water resistant, PFC-free.</p>

<h2>Specifications</h2>
<ul>
<li><strong>Volume:</strong> 12 L · <strong>Weight:</strong> 1.38 lb (620 g)</li>
<li><strong>Dimensions:</strong> 16.1 × 7.9 × 5.1 in</li>
</ul>

<p>5-year limited warranty.</p>`;

const OPTION_DEFINITIONS = [
  { name: "Color", values: ["Digital Gray", "Beige", "Black"] },
];

const VARIANTS: Array<{
  id: string;
  color: string;
  priceCents: number;
  sku: string;
  imageUrl: string;
  imageAlt: string;
  imageTitle: string;
}> = [
  {
    id: `${PRODUCT_ID}-digital-gray`,
    color: "Digital Gray",
    priceCents: PRICE_CENTS,
    sku: "61140148",
    imageUrl: `${CDN}/PacsafeV_12LTechBackpack_61140148_DigitalGray_01_8861f437-74e6-4ab9-8eec-89c67832b8a5.jpg?v=1769879522`,
    imageAlt: "Pacsafe V 12L Anti-Theft Tech Backpack, Digital Gray",
    imageTitle: "Pacsafe V 12L Tech Backpack - Digital Gray",
  },
  {
    id: `${PRODUCT_ID}-beige`,
    color: "Beige",
    priceCents: PRICE_CENTS,
    sku: "61140237",
    imageUrl: `${CDN}/PacsafeV_12LTechBackpack_61140237_Beige_01.jpg?v=1769879522`,
    imageAlt: "Pacsafe V 12L Anti-Theft Tech Backpack, Beige",
    imageTitle: "Pacsafe V 12L Tech Backpack - Beige",
  },
  {
    id: `${PRODUCT_ID}-black`,
    color: "Black",
    priceCents: PRICE_CENTS,
    sku: "61140100",
    imageUrl: `${CDN}/PacsafeV_12LTechBackpack_61140100_Black_01.jpg?v=1769879522`,
    imageAlt: "Pacsafe V 12L Anti-Theft Tech Backpack, Black",
    imageTitle: "Pacsafe V 12L Tech Backpack - Black",
  },
];

export const PACSAFE_V_12L = {
  id: PRODUCT_ID,
  name: "Pacsafe® V 12L Anti-Theft Tech Backpack",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
  mainImageAlt:
    "Pacsafe V 12L Anti-Theft Tech Backpack, Digital Gray - 12L compact tech backpack",
  mainImageTitle:
    "Pacsafe V 12L Anti-Theft Tech Backpack - 12L Compact Backpack",
  priceCents: PRICE_CENTS,
  costPerItemCents: COST_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Pacsafe",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription:
    "Pacsafe V 12L Anti-Theft Tech Backpack—12L compact backpack for tablets and tech. RFID blocking, slashguard, Roobar Sport. Recycled materials. Shop at Culture.",
  pageTitle:
    "Pacsafe V 12L Anti-Theft Tech Backpack | 12L Tech Backpack | Culture",
  sku: "61140148",
  weightGrams: 620,
  weightUnit: "lb" as const,
  images: PRODUCT_IMAGES,
  hasVariants: true,
  optionDefinitions: OPTION_DEFINITIONS,
  variants: VARIANTS,
  /** North America store: US & Canada only (pacsafe.com/pages/shipping). */
  availableCountryCodes: ["US", "CA"] as const,
};
