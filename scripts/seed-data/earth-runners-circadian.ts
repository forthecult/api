/**
 * Seed data for Earth Runners Circadian Adventure Sandals.
 * Sourced from https://www.earthrunners.com/products/circadian-adventure-sandals
 * Only Carbon and Sunset lace variants. Cost $94 (list); sell at 4% above ($97.76).
 * Brand: Earth Runners. Category: Shoes. Size chart: Men's & Women's (from website).
 */

const LIST_PRICE_USD = 94;
const PRICE_MARKUP = 1.04;
const COST_CENTS = Math.round(LIST_PRICE_USD * 100);
const PRICE_CENTS = Math.round(LIST_PRICE_USD * PRICE_MARKUP * 100);

const CDN = "https://cdn.shopify.com/s/files/1/0708/5713/files";

const PRODUCT_ID = "earth-runners-circadian";
const PRODUCT_SLUG = "circadian-adventure-sandals";
const CATEGORY_ID = "mens-shoes";

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  { url: `${CDN}/Carbon_circ2023_7b371855-6ead-49ff-ad30-c1f9c7376936.jpg?v=1749057390`, alt: "Earth Runners Circadian sandals, Carbon lace - 9mm Vibram sole", title: "Circadian Sandals - Carbon" },
  { url: `${CDN}/Sunset_circ2023_33ad29c4-1741-42e2-a43d-1a181a06e05c.jpg?v=1749180263`, alt: "Earth Runners Circadian sandals, Sunset lace - earthing adventure sandals", title: "Circadian Sandals - Sunset" },
  { url: `${CDN}/Carbon_Sole.png?v=1764616369`, alt: "Circadian Carbon sole detail - grounded conductive lace", title: "Circadian - Carbon sole" },
  { url: `${CDN}/Sunset_Sole.png?v=1764616369`, alt: "Circadian Sunset sole detail", title: "Circadian - Sunset sole" },
  { url: `${CDN}/Sunset_top.png?v=1764616369`, alt: "Circadian Sunset lace top view", title: "Circadian - Sunset top" },
  { url: `${CDN}/Carbon_Sole.png?v=1764616369`, alt: "Circadian 9mm Vibram Gumlite outsole", title: "Circadian - Outsole" },
];

const FEATURES: string[] = [
  "9mm Vibram® Gumlite outsole (7.5mm outsole + 1.5mm footbed)—medium thickness, excellent wet grip",
  "Weight: 5.9 oz (single sandal, men's 9 / women's 11)",
  "Earth Grip footbed: moisture-wicking canvas, GOTS (Organic) certified small-batch dye",
  "Grounded Conductive Laces™ with copper plug for earthing when worn on bare earth",
  "Carbon & Sunset: Ergonomic Lifestyle Laces (9/16\" Double Tubular Webbing, Double SS conductive thread)",
  "Zero drop, minimalist design inspired by Tarahumara huarache sandals",
  "Buckles: injection molded in Santa Cruz, CA with 25% recycled plastic",
  "1% of sales donated to True Messages (Tarahumara running heritage)",
];

const DESCRIPTION = `The Circadian will keep you secure and in tune with the earth's natural rhythms—at every step. Our #1 best-selling adventure sandal, the Circadian features a medium-thick 9mm Vibram® sole, excellent wet grip, and a moderate ground feel. The minimalist nature of Earth Runners sandals offers a gentle reminder to yourself—and others—of the oneness you share with the Earth.

Weight: 5.9 oz (single sandal, men's 9 / women's 11)
Thickness: 7.5mm outsole + 1.5mm footbed = 9mm
Sole: Vibram® Gumlite Outsole (domestically sourced)
Footbed: Earth Grip — moisture-wicking canvas, GOTS (Organic) certified small-batch dye

Lace options in this listing: Carbon Lifestyle Lace and Sunset Lifestyle Lace. Both are Ergonomic Grounded Conductive Laces™ with earthing plug and conductive stainless-steel thread.

We proudly donate 1% of all sales to True Messages, a non-profit focused on honoring the running heritage of the Tarahumara culture and supporting the youth of the community.`;

/** Size chart: Men's & Women's (from Earth Runners website). Used for size_chart table + description. */
const SIZES_ROW: Array<{ usa: string; uk: string; eur: string; lengthCm: string; printIn: string }> = [
  { usa: "4M / 6W", uk: "3", eur: "36", lengthCm: "23.4", printIn: "9-3/16\"" },
  { usa: "4.5M / 6.5W", uk: "3.5", eur: "36", lengthCm: "23.8", printIn: "9-3/8\"" },
  { usa: "5M / 7W", uk: "4", eur: "37", lengthCm: "24.2", printIn: "9-9/16\"" },
  { usa: "5.5M / 7.5W", uk: "4.5", eur: "37.5", lengthCm: "24.5", printIn: "9-11/16\"" },
  { usa: "6M / 8W", uk: "5", eur: "38", lengthCm: "24.9", printIn: "9-13/16\"" },
  { usa: "6.5M / 8.5W", uk: "5.5", eur: "39", lengthCm: "25.4", printIn: "10\"" },
  { usa: "7M / 9W", uk: "6", eur: "39", lengthCm: "25.7", printIn: "10-1/8\"" },
  { usa: "7.5M / 9.5W", uk: "6.5", eur: "40", lengthCm: "26.1", printIn: "10-1/4\"" },
  { usa: "8M / 10W", uk: "7", eur: "41", lengthCm: "26.5", printIn: "10-7/16\"" },
  { usa: "8.5M / 10.5W", uk: "7.5", eur: "41", lengthCm: "26.9", printIn: "10-9/16\"" },
  { usa: "9M / 11W", uk: "8", eur: "42", lengthCm: "27.3", printIn: "10-11/16\"" },
  { usa: "9.5M / 11.5W", uk: "8.5", eur: "43", lengthCm: "27.8", printIn: "10-7/8\"" },
  { usa: "10M / 12W", uk: "9", eur: "43", lengthCm: "28.2", printIn: "11-1/16\"" },
  { usa: "10.5M / 12.5W", uk: "9.5", eur: "44", lengthCm: "28.5", printIn: "11-3/16\"" },
  { usa: "11M / 13W", uk: "10", eur: "44.5", lengthCm: "28.9", printIn: "11-3/8\"" },
  { usa: "11.5M / 13.5W", uk: "10.5", eur: "45", lengthCm: "29.4", printIn: "11-9/16\"" },
  { usa: "12M / 14W", uk: "11", eur: "46", lengthCm: "29.8", printIn: "11-3/4\"" },
  { usa: "12.5M / 14.5W", uk: "11.5", eur: "46", lengthCm: "30.1", printIn: "11-7/8\"" },
  { usa: "13M / 15W", uk: "12", eur: "47", lengthCm: "30.4", printIn: "12-1/16\"" },
  { usa: "13.5M / 15.5W", uk: "12.5", eur: "47.5", lengthCm: "30.8", printIn: "12-1/8\"" },
  { usa: "14M / 16W", uk: "13", eur: "48", lengthCm: "31.2", printIn: "12-1/4\"" },
];

/** Single combined table: one row per size, columns USA, UK, EUR, Length. */
function buildSizeChartImperial() {
  return {
    sizeTables: [
      {
        type: "Adults",
        unit: "in",
        description: "Circadian Sandals — Men's & Women's. Measure your foot and match to sandal length; use Earth Runners' print template to confirm fit.",
        /** Same size key across all columns so UI can render one table. */
        measurements: [
          { type_label: "USA (Men's / Women's)", values: SIZES_ROW.map((r) => ({ size: r.usa, value: r.usa })) },
          { type_label: "UK", values: SIZES_ROW.map((r) => ({ size: r.usa, value: r.uk })) },
          { type_label: "EUR", values: SIZES_ROW.map((r) => ({ size: r.usa, value: r.eur })) },
          { type_label: "Length (in)", values: SIZES_ROW.map((r) => ({ size: r.usa, value: r.printIn })) },
        ],
      },
    ],
  };
}

function buildSizeChartMetric() {
  return {
    sizeTables: [
      {
        type: "Adults",
        unit: "cm",
        description: "Circadian Sandals — Men's & Women's. Sandal length in cm.",
        measurements: [
          { type_label: "USA (Men's / Women's)", values: SIZES_ROW.map((r) => ({ size: r.usa, value: r.usa })) },
          { type_label: "UK", values: SIZES_ROW.map((r) => ({ size: r.usa, value: r.uk })) },
          { type_label: "EUR", values: SIZES_ROW.map((r) => ({ size: r.usa, value: r.eur })) },
          { type_label: "Length (cm)", values: SIZES_ROW.map((r) => ({ size: r.usa, value: r.lengthCm })) },
        ],
      },
    ],
  };
}

export const CIRCADIAN_SIZE_CHART = {
  id: "size-chart-earth-runners-circadian",
  provider: "manual" as const,
  brand: "Earth Runners",
  model: "Circadian",
  displayName: "Circadian Sandals (Men's & Women's)",
  dataImperial: buildSizeChartImperial(),
  dataMetric: buildSizeChartMetric(),
};

const LACE_OPTIONS = [
  { name: "Carbon", skuPrefix: "CA-CIR", imageUrl: `${CDN}/Carbon_circ2023_7b371855-6ead-49ff-ad30-c1f9c7376936.jpg?v=1749057390`, imageAlt: "Earth Runners Circadian sandals, Carbon Lifestyle Lace", imageTitle: "Circadian Sandals - Carbon" },
  { name: "Sunset", skuPrefix: "SU-CIR", imageUrl: `${CDN}/Sunset_circ2023_33ad29c4-1741-42e2-a43d-1a181a06e05c.jpg?v=1749180263`, imageAlt: "Earth Runners Circadian sandals, Sunset Lifestyle Lace", imageTitle: "Circadian Sandals - Sunset" },
] as const;

/** One display value per size row: "Men's 4", "Women's 6", "Men's 4.5", "Women's 6.5", ... (44 total). */
function getSizeDisplayValues(): string[] {
  const out: string[] = [];
  for (const row of SIZES_ROW) {
    const [mPart, wPart] = row.usa.split(/\s*\/\s*/).map((s) => s.trim());
    const menNum = mPart?.replace(/M$/, "").trim() ?? "";
    const womenNum = wPart?.replace(/W$/, "").trim() ?? "";
    out.push(`Men's ${menNum}`, `Women's ${womenNum}`);
  }
  return out;
}

const SIZE_DISPLAY_VALUES = getSizeDisplayValues();

/** Size display (e.g. "Men's 4") -> index into SIZES_ROW (0–21) for SKU. */
function sizeDisplayToRowIndex(sizeDisplay: string): number {
  const i = SIZE_DISPLAY_VALUES.indexOf(sizeDisplay);
  return i < 0 ? 0 : Math.floor(i / 2);
}

const OPTION_DEFINITIONS = [
  { name: "Lace", values: LACE_OPTIONS.map((l) => l.name) },
  { name: "Size", values: SIZE_DISPLAY_VALUES },
];

/** Lace × Size variants: 2 lace × 44 size options = 88. Men's 4 and Women's 6 share same SKU (same physical size). */
const VARIANTS: Array<{
  id: string;
  color: string;
  size: string;
  priceCents: number;
  sku: string;
  imageUrl: string;
  imageAlt: string;
  imageTitle: string;
  stockQuantity: number;
}> = [];
for (const lace of LACE_OPTIONS) {
  for (const sizeDisplay of SIZE_DISPLAY_VALUES) {
    const rowIndex = sizeDisplayToRowIndex(sizeDisplay);
    const row = SIZES_ROW[rowIndex]!;
    const sizeSlug = row.usa.replace(/\s*\/\s*/g, "-").replace(/\./g, "");
    const id = `${PRODUCT_ID}-${lace.name.toLowerCase()}-${sizeDisplay.replace(/\s+/g, "-").replace(/\./g, "")}`;
    VARIANTS.push({
      id,
      color: lace.name,
      size: sizeDisplay,
      priceCents: PRICE_CENTS,
      sku: `${lace.skuPrefix}-${sizeSlug}`,
      imageUrl: lace.imageUrl,
      imageAlt: lace.imageAlt,
      imageTitle: lace.imageTitle,
      stockQuantity: 99,
    });
  }
}

export const EARTH_RUNNERS_CIRCADIAN = {
  id: PRODUCT_ID,
  name: "Circadian Sandals",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
  mainImageAlt: "Earth Runners Circadian adventure sandals - 9mm Vibram sole, Carbon or Sunset lace",
  mainImageTitle: "Circadian Sandals — Earth Runners",
  priceCents: PRICE_CENTS,
  costPerItemCents: COST_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Earth Runners",
  model: "Circadian",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription: "Earth Runners Circadian sandals—9mm Vibram sole, Carbon & Sunset lace. Earthing, minimalist. Men's & Women's sizes. Shop at Culture.",
  pageTitle: "Circadian Sandals | Earth Runners 9mm Vibram | Culture",
  sku: "CA-CIR",
  weightGrams: 227,
  weightUnit: "oz" as const,
  images: PRODUCT_IMAGES,
  hasVariants: true,
  optionDefinitions: OPTION_DEFINITIONS,
  variants: VARIANTS,
};
