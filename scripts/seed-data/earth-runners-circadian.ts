/**
 * Seed data for Earth Runners Circadian Adventure Sandals.
 * Sourced from https://www.earthrunners.com/products/circadian-adventure-sandals
 * Variants: Men/Women × Size (22 physical sizes). Cost $94 (list); sell at 4% above ($97.76).
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
  "9mm Vibram® Gumlite outsole—medium thickness, strong wet grip",
  "Grounded Conductive Laces™ with copper plug for earthing on natural surfaces",
  "Earth Grip footbed: GOTS-certified canvas, moisture-wicking",
  "Zero-drop, minimalist design; Men's & Women's sizes",
  "1% of sales to True Messages (Tarahumara running heritage)",
];

const DESCRIPTION = `<p>The Circadian is Earth Runners’ best-selling adventure sandal: a 9mm Vibram Gumlite sole (7.5mm outsole + 1.5mm footbed) that gives solid grip and a moderate ground feel without extra bulk. The footbed is Earth Grip canvas—GOTS-certified, moisture-wicking—and the laces are Grounded Conductive Laces™ with a copper plug so you can earth when you’re on dirt, sand, or grass.</p>

<p>Laces use double tubular webbing and conductive stainless-steel thread. Buckles are injection-molded in Santa Cruz, CA with 25% recycled plastic. Single sandal weight is about 5.9 oz (men’s 9 / women’s 11).</p>

<p>Earth Runners donates 1% of sales to True Messages, supporting Tarahumara running heritage and youth in the community.</p>`;

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

/** Color option: Carbon or Sunset. */
const COLORS = ["Carbon", "Sunset"] as const;

/** Option 2: Men's or Women's. */
const GENDERS = ["Men's", "Women's"] as const;

/** Size option values: one per physical sandal length (e.g. "4M / 6W"). */
const SIZE_OPTION_VALUES = SIZES_ROW.map((r) => r.usa);

/** Option order: Color → Men/Women → Size (2 × 2 × 22 = 88 variants). */
const OPTION_DEFINITIONS = [
  { name: "Color", values: [...COLORS] },
  { name: "Men/Women", values: [...GENDERS] },
  { name: "Size", values: SIZE_OPTION_VALUES },
];

/** SKU slug from size row (e.g. "4M-6W"). Same SKU for Men's and Women's of same physical size. */
function sizeRowToSkuSlug(row: (typeof SIZES_ROW)[number]): string {
  return row.usa.replace(/\s*\/\s*/g, "-").replace(/\s/g, "").replace(/\./g, "");
}

/** Variant images by color (Carbon vs Sunset). */
const VARIANT_IMAGES: Record<
  (typeof COLORS)[number],
  { url: string; alt: string; title: string }
> = {
  Carbon: {
    url: `${CDN}/Carbon_circ2023_7b371855-6ead-49ff-ad30-c1f9c7376936.jpg?v=1749057390`,
    alt: "Earth Runners Circadian sandals, Carbon - 9mm Vibram sole",
    title: "Circadian Sandals — Carbon",
  },
  Sunset: {
    url: `${CDN}/Sunset_circ2023_33ad29c4-1741-42e2-a43d-1a181a06e05c.jpg?v=1749180263`,
    alt: "Earth Runners Circadian sandals, Sunset - earthing adventure sandals",
    title: "Circadian Sandals — Sunset",
  },
};

/** Color × Men/Women × Size variants: 2 × 2 × 22 = 88. */
const VARIANTS: Array<{
  id: string;
  color: string;
  gender: string;
  size: string;
  priceCents: number;
  sku: string;
  imageUrl: string;
  imageAlt: string;
  imageTitle: string;
  stockQuantity: number;
  label: string;
}> = [];
for (const color of COLORS) {
  const img = VARIANT_IMAGES[color];
  for (const gender of GENDERS) {
    for (let i = 0; i < SIZES_ROW.length; i++) {
      const row = SIZES_ROW[i]!;
      const sizeSlug = sizeRowToSkuSlug(row);
      const genderSlug = gender.toLowerCase().replace(/'/g, "");
      const colorSlug = color.toLowerCase();
      const id = `${PRODUCT_ID}-${colorSlug}-${genderSlug}-${sizeSlug}`;
      VARIANTS.push({
        id,
        color,
        gender,
        size: row.usa,
        priceCents: PRICE_CENTS,
        sku: `CA-CIR-${colorSlug.slice(0, 2).toUpperCase()}-${sizeSlug}`,
        imageUrl: img.url,
        imageAlt: img.alt,
        imageTitle: img.title,
        stockQuantity: 99,
        label: `${color} ${gender} ${row.usa}`,
      });
    }
  }
}

export const EARTH_RUNNERS_CIRCADIAN = {
  id: PRODUCT_ID,
  name: "Circadian Sandals",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
  mainImageAlt: "Earth Runners Circadian adventure sandals - 9mm Vibram sole",
  mainImageTitle: "Circadian Sandals — Earth Runners",
  priceCents: PRICE_CENTS,
  costPerItemCents: COST_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Earth Runners",
  model: "Circadian",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription: "Earth Runners Circadian sandals—9mm Vibram sole. Earthing, minimalist. Men's & Women's sizes. Shop at Culture.",
  pageTitle: "Circadian Sandals | Earth Runners 9mm Vibram | Culture",
  sku: "CA-CIR",
  weightGrams: 227,
  weightUnit: "oz" as const,
  images: PRODUCT_IMAGES,
  hasVariants: true,
  optionDefinitions: OPTION_DEFINITIONS,
  variants: VARIANTS,
};
