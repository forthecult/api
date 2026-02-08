/**
 * Seed data for Spout Monolith — atmospheric water generator.
 * Sourced from https://www.spoutwater.com/products/spout-monolith
 * US shipping only. Cost $1,199; sell at 4% above ($1,246.96). Shipping: $75. Ships in 1-2 weeks.
 * Brand: Spout. Category: Kitchen Accessories.
 */

const LIST_PRICE_USD = 1199;
const PRICE_MARKUP = 1.04;
const COST_CENTS = Math.round(LIST_PRICE_USD * 100);
const PRICE_CENTS = Math.round(LIST_PRICE_USD * PRICE_MARKUP * 100);

const CDN = "https://cdn.shopify.com/s/files/1/0611/2945/7877/files";

const PRODUCT_ID = "spout-monolith";
const PRODUCT_SLUG = "spout-monolith";
const CATEGORY_ID = "home-kitchen";

/** US only — product_available_country will be set to ["US"]. */
export const AVAILABLE_COUNTRY_CODES = ["US"] as const;

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  { url: `${CDN}/DSCF4188.jpg?v=1762970741`, alt: "Spout Monolith atmospheric water generator - white countertop unit", title: "Spout Monolith - Main" },
  { url: `${CDN}/DSCF1984.jpg?v=1762970741`, alt: "Spout Monolith water from air - pure alkaline water", title: "Spout Monolith" },
  { url: `${CDN}/DSCF4228.jpg?v=1762970741`, alt: "Spout Monolith and Always Fresh Pitcher", title: "Spout Monolith with pitcher" },
  { url: `${CDN}/DSCF2227.jpg?v=1762970741`, alt: "Spout atmospheric water generator - no plumbing needed", title: "Spout Monolith - No plumbing" },
  { url: `${CDN}/DSCF4330_1.jpg?v=1762970741`, alt: "Spout Monolith air purification and water generation", title: "Spout Monolith - Dual function" },
  { url: `${CDN}/DSCF2839.jpg?v=1762970741`, alt: "Spout Monolith compact design", title: "Spout Monolith - Design" },
  { url: `${CDN}/DSCF4267.jpg?v=1762970741`, alt: "Spout Monolith countertop water from air", title: "Spout Monolith - Countertop" },
];

const FEATURES: string[] = [
  "Makes up to 2.5 gallons of water per day from air—no plumbing",
  "Six-stage filtration; tested non-detect for microplastics, PFAS, and lead",
  "Doubles as an air purifier for the room",
  "Always Fresh Pitcher with UV-C; smart fill and wireless charging",
  "1-year warranty; 30-day money-back guarantee; ships US in 1–2 weeks",
];

const DESCRIPTION = `<p>Spout turns humidity in the air into drinking water. Plug it in, set the half-gallon pitcher on the base, and the machine pulls moisture from the room, runs it through six levels of filtration, and fills the pitcher. Output is alkaline (calcium, magnesium, potassium added) and tested non-detect for microplastics, PFAS, and lead.</p>

<p>The same airflow is filtered, so the unit also acts as an air purifier—dust, odors, and VOCs are reduced. The Always Fresh Pitcher uses UV-C to keep water clean for days; smart sensors stop the fill when the pitcher is full. Fridge-ready pitcher; base is dishwasher-safe.</p>

<h2>Specifications</h2>
<ul>
<li><strong>Daily output:</strong> 0.75–2.5 gal (conditions-dependent)</li>
<li><strong>Size:</strong> 18 × 14.5 × 8.5 in · 25 lb</li>
<li><strong>Power:</strong> 360–640 W · ~5–9 kWh/gal</li>
<li><strong>Environment:</strong> 33°F–105°F, 20–100% RH</li>
</ul>

<p>Includes Monolith, Always Fresh Pitcher, air filter, water filter, carry bag, and quickstart guide. Filter service about every 3 months. US only.</p>`;

export const SPOUT_MONOLITH = {
  id: PRODUCT_ID,
  name: "Spout Monolith",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
  mainImageAlt: "Spout Monolith atmospheric water generator - pure water from air, white",
  mainImageTitle: "Spout Monolith — Atmospheric Water Generator",
  priceCents: PRICE_CENTS,
  costPerItemCents: COST_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Spout",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription: "Spout Monolith atmospheric water generator — pure alkaline water from air. No plumbing. PFAS, microplastics, lead removed. Air purifier built in. US shipping. Culture.",
  pageTitle: "Spout Monolith | Atmospheric Water Generator | Culture",
  sku: "SPOUT-MONOLITH",
  weightGrams: 9979,
  weightUnit: "lb" as const,
  images: PRODUCT_IMAGES,
  hasVariants: false,
  /** US shipping only. */
  availableCountryCodes: AVAILABLE_COUNTRY_CODES,
  /** Ships within 1-2 weeks. */
  handlingDaysMin: 7,
  handlingDaysMax: 14,
};
