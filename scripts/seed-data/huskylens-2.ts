/**
 * Seed data for DFRobot HUSKYLENS 2 — 6 TOPS AI Vision Sensor with MCP & LLM support.
 * Sourced from https://www.dfrobot.com/huskylens/huskylens2 and https://www.dfrobot.com/product-2995.html
 * Brand: DFRobot. Category: Tech Accessories. Price: 4% above cost ($74.90 → $77.90).
 */

const COST_CENTS = 7490; // $74.90 DFRobot list
const PRICE_MARKUP = 1.04;
const PRICE_CENTS = Math.round(COST_CENTS * PRICE_MARKUP);

const PRODUCT_ID = "dfrobot-huskylens-2";
const PRODUCT_SLUG = "dfrobot-huskylens-2";
const CATEGORY_ID = "accessories-tech";

// All product gallery and intro images from https://www.dfrobot.com/product-2995.html
const DFR_IMG = "https://dfimg.dfrobot.com/enshop/image/data/SEN0638";

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  // Gallery (Photos) — main product shots
  {
    url: `${DFR_IMG}/SEN0638_Main_01_226x150.jpg.webp`,
    alt: "HUSKYLENS 2 AI vision sensor - main view, camera, USB-C, Gravity interface",
    title: "HUSKYLENS 2 - Main view",
  },
  {
    url: `${DFR_IMG}/SEN0638_Main_02_226x150.jpg.webp`,
    alt: "HUSKYLENS 2 - alternate angle",
    title: "HUSKYLENS 2 - Angle view",
  },
  {
    url: `${DFR_IMG}/SEN0638_Main_03_226x150.jpg.webp`,
    alt: "HUSKYLENS 2 - touchscreen display",
    title: "HUSKYLENS 2 - Screen",
  },
  {
    url: `${DFR_IMG}/SEN0638_Main_04_226x150.jpg.webp`,
    alt: "HUSKYLENS 2 - ports and connections",
    title: "HUSKYLENS 2 - Ports",
  },
  {
    url: `${DFR_IMG}/SEN0638_Main_05_226x150.jpg.webp`,
    alt: "HUSKYLENS 2 with optional module",
    title: "HUSKYLENS 2 - With module",
  },
  {
    url: `${DFR_IMG}/SEN0638_Main_06_226x150.jpg.webp`,
    alt: "HUSKYLENS 2 packaging and contents",
    title: "HUSKYLENS 2 - Packaging",
  },
  // Introduction section images
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
    url: `${DFR_IMG}/Model%20Combination.gif`,
    alt: "HUSKYLENS 2 - Flexible model combination for diverse applications",
    title: "HUSKYLENS 2 - Model combination",
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
  "6 TOPS on-device AI — Kendryte K230 dual-core 1.6 GHz, 1 GB LPDDR4, 8 GB eMMC",
  "20+ built-in models: face/object recognition, gesture, pose, OCR, barcode, line tracking, fall detection",
  "Built-in MCP service — gives LLMs real-world context (who, what, where) instead of raw snapshots",
  "Deploy custom YOLO models — train and run your own vision models on-device",
  "2.4\" IPS touchscreen (640×480), full-lamination capacitive; 2 MP 60 FPS camera, replaceable module",
  "UART / I2C Gravity interface — works with Arduino, micro:bit, Raspberry Pi, ESP32, UNIHIKER",
  "Real-time video streaming (wired USB-C or optional Wi-Fi module); TF card slot, microphone, 1 W speaker",
  "3.3–5 V, 1.5–3 W; 70×58×19 mm, 90 g; optional microscope and night vision lens modules",
];

const DESCRIPTION = `<p>HUSKYLENS 2 is a next-generation AI vision sensor that puts 6 TOPS of on-device machine learning in your hands. Control devices with gestures, give LLMs real-world awareness via its built-in MCP service, or deploy your own custom YOLO models—all without the cloud.</p>

<h2>Control at a distance</h2>
<p>Gesture recognition and human keypoint detection turn your hands into controllers. Build contactless UIs, interactive robots, or motion-based games that understand exactly what you're doing.</p>

<h2>Empowers LLMs with context, not just pixels</h2>
<p>Other vision sensors send raw snapshots to AI. HUSKYLENS 2 runs a built-in MCP server that tells the LLM <em>who</em> is in the frame and <em>what</em> they're doing—so models can follow your rules and make better decisions.</p>

<h2>20+ built-in models, plus your own</h2>
<p>Face detection and recognition, object tracking, hand keypoints, pose recognition, OCR, barcode/QR, line tracking, fall detection, and more. Train custom models with YOLO and deploy them directly on the device.</p>

<h2>Replaceable camera, broad compatibility</h2>
<p>Swap in manual-focus, microscope, or night vision modules. Connect over Gravity (UART/I2C) to Arduino, Raspberry Pi, micro:bit, ESP32, and UNIHIKER. Optional Wi-Fi module for wireless streaming and MQTT.</p>

<h2>Specifications</h2>
<ul>
<li><strong>Processor:</strong> Kendryte K230 dual-core 1.6 GHz, 6 TOPS AI</li>
<li><strong>Memory / storage:</strong> 1 GB LPDDR4, 8 GB eMMC</li>
<li><strong>Display:</strong> 2.4" IPS 640×480, capacitive touch</li>
<li><strong>Camera:</strong> GC2093 2 MP, 1/2.9", 60 FPS, replaceable</li>
<li><strong>Interfaces:</strong> USB-C, Gravity 4-pin (I2C/UART), TF card slot</li>
<li><strong>Power:</strong> 3.3–5 V, 1.5–3 W</li>
<li><strong>Dimensions / weight:</strong> 70×58×19 mm, 90 g</li>
</ul>

<h2>In the box</h2>
<ul>
<li>HUSKYLENS 2 AI vision sensor × 1</li>
<li>M3 screws × 6, M3 nuts × 6</li>
<li>Mounting bracket, heightening bracket</li>
<li>Gravity 4P cable (30 cm), dual-plug PH2.0-4P cable (20 cm)</li>
<li>Power adapter board</li>
</ul>`;

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
