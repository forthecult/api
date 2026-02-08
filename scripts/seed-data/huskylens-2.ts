/**
 * Seed data for DFRobot HUSKYLENS 2 — 6 TOPS AI Vision Sensor with MCP & LLM support.
 * Sourced from https://www.dfrobot.com/huskylens/huskylens2 and https://www.dfrobot.com/product-2995.html
 * Brand: DFRobot. Category: Tech Accessories. Price: 4% above cost ($74.90 → $77.90).
 * Shipping: DFRobot sells in USD/EUR/GBP; no explicit country list found. No product_available_country restriction = available everywhere.
 * Images: vendor CDN (dfimg.dfrobot.com). Run db:upload-curated-product-images to pull, optimize, and upload to UploadThing.
 */

const COST_CENTS = 7490; // $74.90 DFRobot list
const PRICE_MARKUP = 1.04;
const PRICE_CENTS = Math.round(COST_CENTS * PRICE_MARKUP);

const PRODUCT_ID = "dfrobot-huskylens-2";
const PRODUCT_SLUG = "dfrobot-huskylens-2";
const CATEGORY_ID = "accessories-tech";

// Product images from DFRobot CDN — carousel uses 1220x813; intro section uses _0x0 (https://www.dfrobot.com/product-2995.html)
const DFR_IMG = "https://dfimg.dfrobot.com/enshop/image/data/SEN0638";

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  // Carousel / gallery (1220x813)
  {
    url: `${DFR_IMG}/SEN0638_Main_01_1220x813.jpg.webp`,
    alt: "HUSKYLENS 2 AI vision sensor - main view, camera, USB-C, Gravity interface",
    title: "HUSKYLENS 2 - Main view",
  },
  {
    url: `${DFR_IMG}/SEN0638_Main_02_1220x813.jpg.webp`,
    alt: "HUSKYLENS 2 - alternate angle",
    title: "HUSKYLENS 2 - Angle view",
  },
  {
    url: `${DFR_IMG}/SEN0638_Main_03_1220x813.jpg.webp`,
    alt: "HUSKYLENS 2 - touchscreen display",
    title: "HUSKYLENS 2 - Screen",
  },
  {
    url: `${DFR_IMG}/SEN0638_Main_04_1220x813.jpg.webp`,
    alt: "HUSKYLENS 2 - ports and connections",
    title: "HUSKYLENS 2 - Ports",
  },
  {
    url: `${DFR_IMG}/SEN0638_Main_05_1220x813.jpg.webp`,
    alt: "HUSKYLENS 2 with optional module",
    title: "HUSKYLENS 2 - With module",
  },
  {
    url: `${DFR_IMG}/SEN0638_Main_06_1220x813.jpg.webp`,
    alt: "HUSKYLENS 2 packaging and contents",
    title: "HUSKYLENS 2 - Packaging",
  },
  // Intro section (full-size _0x0)
  {
    url: `${DFR_IMG}/6%20TOPS%20AI%20accelerator_0x0.jpg.webp`,
    alt: "HUSKYLENS 2 - 6 TOPS on-device AI accelerator",
    title: "HUSKYLENS 2 - 6 TOPS AI",
  },
  {
    url: `${DFR_IMG}/20%20models_0x0.jpg.webp`,
    alt: "HUSKYLENS 2 - 20+ built-in AI models",
    title: "HUSKYLENS 2 - Built-in models",
  },
  {
    url: `${DFR_IMG}/MCP%20LLM-3_0x0.png.webp`,
    alt: "HUSKYLENS 2 - MCP and LLM contextual awareness",
    title: "HUSKYLENS 2 - MCP LLM",
  },
  {
    url: `${DFR_IMG}/Advanced%20Contextual%20Awareness_0x0.jpg.webp`,
    alt: "HUSKYLENS 2 - Advanced contextual awareness for LLMs",
    title: "HUSKYLENS 2 - Contextual awareness",
  },
  {
    url: `${DFR_IMG}/Deployment%20of%20Custom%20Models_0x0.jpg.webp`,
    alt: "HUSKYLENS 2 - Deploy custom YOLO models",
    title: "HUSKYLENS 2 - Custom models",
  },
  {
    url: `${DFR_IMG}/wifi%20module-1_0x0.png.webp`,
    alt: "HUSKYLENS 2 - Real-time video streaming with optional Wi-Fi module",
    title: "HUSKYLENS 2 - Wi-Fi streaming",
  },
  {
    url: `${DFR_IMG}/Lens_0x0.png.webp`,
    alt: "HUSKYLENS 2 - Replaceable camera module",
    title: "HUSKYLENS 2 - Replaceable lens",
  },
  {
    url: `${DFR_IMG}/Compatibility_0x0.jpg.webp`,
    alt: "HUSKYLENS 2 - Arduino, Raspberry Pi, ESP32, micro:bit, UNIHIKER",
    title: "HUSKYLENS 2 - Compatibility",
  },
  {
    url: `${DFR_IMG}/models%20hub%2001_0x0.jpg.webp`,
    alt: "HUSKYLENS 2 - Model Hub for vertical models",
    title: "HUSKYLENS 2 - Model Hub",
  },
];

const FEATURES: string[] = [
  "6 TOPS on-device AI; 20+ built-in models (face, object, gesture, OCR, barcode, etc.)",
  "Built-in MCP server gives LLMs structured context, not raw pixels",
  "Deploy custom YOLO models on-device; 2.4\" touchscreen, 2 MP replaceable camera",
  "Gravity (UART/I2C) for Arduino, Raspberry Pi, ESP32, micro:bit, UNIHIKER",
  "USB-C or optional Wi-Fi; 70×58×19 mm, 90 g",
];

const DESCRIPTION = `<p>HUSKYLENS 2 is an AI vision sensor that runs 6 TOPS of inference on-device. Use it for gesture control, object and face recognition, OCR, barcodes, line tracking, or fall detection—or train and load your own YOLO models. No cloud required.</p>

<p>Its built-in MCP server is the differentiator for LLM projects: instead of sending raw images, it tells the model who and what is in the frame, so assistants can reason about the real world. Connect over Gravity (UART/I2C) to Arduino, Raspberry Pi, ESP32, micro:bit, or UNIHIKER; stream video over USB-C or an optional Wi-Fi module.</p>

<p>The 2 MP camera module is replaceable (manual-focus, microscope, and night vision modules available). TF card slot, microphone, and 1 W speaker are onboard. Power: 3.3–5 V, 1.5–3 W.</p>

<h2>In the box</h2>
<p>HUSKYLENS 2 unit, mounting brackets, Gravity 4P and PH2.0-4P cables, power adapter board, M3 hardware.</p>`;

export const HUSKYLENS_2 = {
  id: PRODUCT_ID,
  name: "HUSKYLENS 2 — 6 TOPS AI Vision Sensor with MCP & LLM Support",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
  mainImageAlt:
    "HUSKYLENS 2 AI vision sensor - 6 TOPS on-device AI, MCP service for LLMs, 20+ models",
  mainImageTitle: "HUSKYLENS 2 | 6 TOPS AI Vision Sensor | DFRobot",
  priceCents: PRICE_CENTS,
  costPerItemCents: COST_CENTS,
  categoryId: CATEGORY_ID,
  brand: "DFRobot",
  model: "HUSKYLENS 2",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription:
    "HUSKYLENS 2: 6 TOPS AI vision sensor with built-in MCP and LLM support. 20+ models, custom YOLO deployment, UART/I2C. DFRobot. Buy at Culture.",
  pageTitle: "HUSKYLENS 2 | 6 TOPS AI Vision Sensor with MCP & LLM | Culture",
  sku: "SEN0638",
  hasVariants: false,
  continueSellingWhenOutOfStock: true,
  images: PRODUCT_IMAGES,
};
