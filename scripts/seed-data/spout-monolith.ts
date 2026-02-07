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
  "Up to 2.5 gallons of water per day from air — no plumbing needed",
  "Tested non-detect for microplastics, PFAS, or lead",
  "Doubles as an air purifier (removes dust, odors, VOCs)",
  "Six levels of filtration for air and water",
  "Always Fresh Pitcher with UV-C light keeps water clean for days",
  "Smart sensors stop fill when pitcher is full; wireless charging",
  "Fridge-ready half-gallon pitcher; dishwasher-safe base",
  "Adds calcium, magnesium, potassium for alkaline water",
  "Dimensions: 18\" × 14.5\" × 8.5\"; weight 25 lb",
  "1-year limited warranty; 30-day money-back guarantee",
  "Includes: Spout Monolith, Always Fresh Pitcher, air filter, water filter, carry bag, quickstart guide",
];

const DESCRIPTION = `The most revolutionary innovation to drinking water since the tap.

Introducing Spout, the world's smallest powered atmospheric water generator. Turn air into an infinite supply of pure alkaline water — no pipes, no plastic bottles.

**Pure and Safe:** We employ six levels of filtration to the air and the water it produces. The machine also serves as an air purifier for the space it inhabits.

**Wherever, Whenever:** The Spout generates up to 2.5 gallons of water from thin air every day*, so no plumbing needed. Perfect for homelife or vanlife.

**Easy to Use:** Just plug it in and witness pure water... happen.

PRODUCT SPECS

Daily production: 0.75–2.5 gallons*
Power: 360–640 W
Dimensions: 18" × 14.5" × 8.5"
Weight: 25 lb
Pitcher volume: 0.5 gallons
Power per gallon: ~5–9 kWh/gal
T/H range: 33°F–105°F, 20–100% RH
Service period: 3 months (air + water filter)
Rated lifetime est.: 5 years

WHAT'S INCLUDED

Spout Monolith unit, Always Fresh Pitcher, air filter, water filter, carry bag, quickstart guide & user manual. 1-year warranty.

*Depending on conditions. Ships within 1-2 weeks. US only.`;

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
