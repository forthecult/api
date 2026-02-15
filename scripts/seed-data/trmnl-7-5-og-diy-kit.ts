/**
 * Seed data for TRMNL 7.5" (OG) DIY Kit — e-ink dashboard kit (Seeed x TRMNL).
 * Sourced from Seeed Studio (US). Brand: Seeed Studio. Category: Smart Home.
 * US price $49; we add 5% → $51.45.
 * https://www.seeedstudio.com/TRMNL-7-5-Inch-OG-DIY-Kit-p-6481.html
 *
 * IMAGES: Source URLs only. Run db:upload-curated-product-images after seeding.
 * Markets: Seeed US — US only.
 */

const COST_CENTS = 4900; // $49 US
const PRICE_MARKUP = 1.05;
const PRICE_CENTS = Math.round(COST_CENTS * PRICE_MARKUP); // $51.45

const PRODUCT_ID = "trmnl-7-5-og-diy-kit";
const PRODUCT_SLUG = "trmnl-7-5-og-diy-kit";
const CATEGORY_ID = "smart-home";

/** Direct catalog paths (no cache) so fetch/upload works reliably. From product page gallery. */
const SEEED_MEDIA = "https://media-cdn.seeedstudio.com/media/catalog/product";

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  {
    url: `${SEEED_MEDIA}/1/x/1x1a0509-2.jpg`,
    alt: '7.5" Smart Home Display - e-ink display, XIAO ESP32-S3 PLUS, battery',
    title: '7.5" Smart Home Display - Main',
  },
  {
    url: `${SEEED_MEDIA}/1/x/1x1a0513.jpg`,
    alt: '7.5" Smart Home Display - e-ink display angle',
    title: '7.5" Smart Home Display - Angle',
  },
  {
    url: `${SEEED_MEDIA}/1/x/1x1a0521-2.jpg`,
    alt: '7.5" Smart Home Display - display detail',
    title: '7.5" Smart Home Display - Detail',
  },
  {
    url: `${SEEED_MEDIA}/1/x/1x1a0559.jpg`,
    alt: '7.5" Smart Home Display - components',
    title: '7.5" Smart Home Display - Components',
  },
  {
    url: `${SEEED_MEDIA}/2/-/2-104991005-trmnl-7.5-epaper-display-diy-kit.jpg`,
    alt: '7.5" Smart Home Display - e-paper display kit',
    title: '7.5" Smart Home Display - Kit 2',
  },
  {
    url: `${SEEED_MEDIA}/3/-/3-104991005-trmnl-7.5-epaper-display-diy-kit.jpg`,
    alt: '7.5" Smart Home Display - kit view 3',
    title: '7.5" Smart Home Display - Kit 3',
  },
  {
    url: `${SEEED_MEDIA}/1/-/1-104991005-trmnl-7.5-epaper-display-diy-kit.jpg`,
    alt: '7.5" Smart Home Display - kit view 1',
    title: '7.5" Smart Home Display - Kit 1',
  },
  {
    url: `${SEEED_MEDIA}/4/-/4-104991005-trmnl-7.5-epaper-display-diy-kit.jpg`,
    alt: '7.5" Smart Home Display - kit view 4',
    title: '7.5" Smart Home Display - Kit 4',
  },
  {
    url: `${SEEED_MEDIA}/5/-/5-104991005-trmnl-7.5-epaper-display-diy-kit.jpg`,
    alt: '7.5" Smart Home Display - kit view 5',
    title: '7.5" Smart Home Display - Kit 5',
  },
  {
    url: `${SEEED_MEDIA}/6/-/6-104991005-trmnl-7.5-epaper-display-diy-kit.jpg`,
    alt: '7.5" Smart Home Display - kit view 6',
    title: '7.5" Smart Home Display - Kit 6',
  },
];

const FEATURES: string[] = [
  '7.5" 800×480 monochrome e-ink display; XIAO ESP32-S3 PLUS driver board',
  "2000 mAh rechargeable battery; 10 cm FPC extension cable",
  "TRMNL BYOD ecosystem: 375+ plugins, 8 layouts, no-code dashboards",
  "Home Assistant, Arduino; low-power e-ink for dashboards and signage",
];

const DESCRIPTION = `<p>The TRMNL 7.5" (OG) DIY Kit, co-developed by Seeed Studio and TRMNL, is a versatile e-ink development solution. It includes a 7.5-inch 800×480 monochrome e-ink display, XIAO ESP32-S3 PLUS driver board, 2000 mAh rechargeable battery, and 10 cm FPC extension cable. Fully compatible with the TRMNL BYOD ecosystem, it unlocks over 375 plugins and 8 layouts for no-code dashboard building.</p>

<p>Integrate with Home Assistant for weather or energy use, or tap into Arduino's thousands of projects. Perfect for e-ink dashboards, smart home interfaces, or digital signage—low-power and customizable.</p>`;

export const TRMNL_7_5_OG_DIY_KIT = {
  id: PRODUCT_ID,
  name: '7.5" Smart Home Display',
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
  mainImageAlt:
    '7.5" Smart Home Display - e-ink display, XIAO ESP32-S3 PLUS, battery. Seeed Studio x TRMNL.',
  mainImageTitle: '7.5" Smart Home Display | Seeed Studio x TRMNL',
  priceCents: PRICE_CENTS,
  costPerItemCents: COST_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Seeed Studio",
  model: '7.5" Smart Home Display',
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription:
    '7.5" Smart Home Display: e-ink display, XIAO ESP32-S3 PLUS, battery. Home Assistant, 375+ TRMNL plugins. Seeed Studio x TRMNL. Buy at Culture.',
  pageTitle: '7.5" Smart Home Display | Seeed Studio | Culture',
  sku: "104991005",
  hasVariants: false,
  continueSellingWhenOutOfStock: true,
  images: PRODUCT_IMAGES,
  availableCountryCodes: ["US"] as const,
};
