/**
 * Add Sonoff brand and products via admin API (production or local).
 *
 * Usage (production — use uncommented key at bottom of .env, e.g. ADMIN_AI_API_KEY):
 *   cd relivator
 *   MAIN_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> bun run scripts/seed-sonoff-via-api.ts
 *
 * Or load .env and use ADMIN_AI_API_KEY for production (do not use commented ADMIN_API_KEY).
 */

const MAIN_APP_URL = process.env.MAIN_APP_URL?.trim() || "https://forthecult.store";
// Prefer ADMIN_AI_API_KEY (production / uncommented at bottom of .env); fallback to ADMIN_API_KEY for local
const API_KEY = process.env.ADMIN_AI_API_KEY?.trim() || process.env.ADMIN_API_KEY?.trim();
if (!API_KEY) {
  console.error("Set ADMIN_AI_API_KEY (production, uncommented in .env) or ADMIN_API_KEY. Optionally MAIN_APP_URL (default: https://forthecult.store).");
  process.exit(1);
}

const API_BASE = MAIN_APP_URL.replace(/\/$/, "");
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

async function createBrand() {
  const res = await fetch(`${API_BASE}/api/admin/brands`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Sonoff",
      slug: "sonoff",
      websiteUrl: "https://www.sonoff.tech",
      description:
        "SONOFF (by ITEAD) makes Zigbee and Wi-Fi smart home devices: wireless switches, motion and door/window sensors, temperature/humidity sensors, smart plugs, LED strips, and smart water valves. Zigbee 3.0 compatible.",
      featured: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 409 || res.status === 500 || text.includes("unique") || text.includes("slug")) {
      console.log("Brand Sonoff already exists or create failed (likely duplicate), continuing.");
      const list = await fetch(`${API_BASE}/api/admin/brands?search=Sonoff&limit=5`, { headers });
      const data = (await list.json()) as { items?: Array<{ id: string; name: string }> };
      return data.items?.[0]?.id ?? null;
    }
    throw new Error(`Brand create failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { id: string; name: string; slug: string };
  console.log("Created brand:", json.name, json.id);
  return json.id;
}

interface ProductInput {
  name: string;
  slug: string;
  priceCents: number;
  description: string;
  sourceUrl: string;
  features?: string[];
}

const PRODUCTS: ProductInput[] = [
  {
    name: "SONOFF Zigbee Wireless Switch (SNZB-01P)",
    slug: "sonoff-zigbee-wireless-switch-snzb-01p",
    priceCents: 990,
    description: `Small Zigbee wireless smart switch with custom button actions: single press, double press, and long press to control multiple devices. Zigbee 3.0 compatible; works with SONOFF NSPanel Pro, ZB Bridge Pro, ZBDongle-E. Larger button area, 5-year battery life, external pairing button. Can be used as a doorbell with NSPanel Pro.`,
    sourceUrl: "https://us.itead.cc/us/products/sonoff-zigbee-wireless-switch-snzb-01p",
    features: [
      "Custom single/double/long press actions",
      "Zigbee 3.0 compatible",
      "5-year battery life",
      "3M adhesive + metal plate mounting",
    ],
  },
  {
    name: "SONOFF SNZB-03P Zigbee Motion Sensor",
    slug: "sonoff-zigbee-motion-sensor-snzb-03p",
    priceCents: 1190,
    description: `Low-power Zigbee motion sensor for turning on lights when people arrive and off when they leave (corridors, entrances, stairs). Detection duration as short as 5 seconds, smart environment light detection, 3-year battery life. Local scene linkage works when network is disconnected. Compatible with NSPanel Pro, iHost, ZB Bridge Pro, ZBDongle-E, Echo Plus 2nd.`,
    sourceUrl: "https://us.itead.cc/us/products/sonoff-zigbee-motion-sensor-snzb-03p",
    features: [
      "5s detection duration, 3-year battery",
      "Local scene linkage without network",
      "Security: trigger camera, alarm, app notifications",
    ],
  },
  {
    name: "SONOFF SNZB-04P Zigbee Door/Window Sensor",
    slug: "sonoff-zigbee-door-window-sensor-snzb-04p",
    priceCents: 1090,
    description: `Zigbee 3.0 door/window sensor with tamper-proof feature. Turn on lights when a door opens, trigger alarms and app notifications for unauthorized entry. Tamper alert, 5-year battery, max installation distance 20mm. Local scene linkage when WiFi is down.`,
    sourceUrl: "https://us.itead.cc/us/products/sonoff-zigbee-door-window-sensor-snzb-04p",
    features: [
      "Tamper-proof, tamper alert",
      "5-year battery, 20mm max gap",
      "Local scenes when network is down",
    ],
  },
  {
    name: "SONOFF SNZB-02P Zigbee Temperature and Humidity Sensor",
    slug: "sonoff-zigbee-temperature-humidity-sensor-snzb-02p",
    priceCents: 1090,
    description: `Temperature and humidity sensor with Swiss-made sensor: ±0.2°C and ±2% RH accuracy, data every 5s. Comfort alerts when temp or humidity exceeds your range. Cloud history; 3 mounting options (3M adhesive, metal plate, screw).`,
    sourceUrl: "https://us.itead.cc/us/products/sonoff-zigbee-temperature-and-humidity-sensor-snzb-02p",
    features: [
      "High-accuracy Swiss sensor (±0.2°C, ±2% RH)",
      "Comfort alerts, cloud history",
      "4-year battery, 3 mounting options",
    ],
  },
  {
    name: "SONOFF L3 Pro RGBIC Smart LED Strip Lights (5M/16.4Ft)",
    slug: "sonoff-l3-pro-rgbic-smart-led-strip-lights",
    priceCents: 2699,
    description: `RGBIC LED strip: multiple colors at once (unlike single-color RGB). 44 preset effects, music mode with built-in mic, voice control (Google Assistant, Alexa, SmartThings). Local control. Cut every 33.33mm (cut segment needs adapter to work).`,
    sourceUrl: "https://us.itead.cc/us/products/sonoff-l3-pro-rgbic-smart-led-strip-lights",
    features: [
      "RGBIC: multiple colors simultaneously",
      "44 preset effects, music sync",
      "Voice control, local control",
    ],
  },
  {
    name: "SONOFF Zigbee Smart Plug (iPlug S40 Lite)",
    slug: "sonoff-zigbee-smart-plug-iplug-s40-lite",
    priceCents: 1290,
    description: `Zigbee smart plug, 15A max / 1800W. Works as Zigbee router to extend range. Compatible with Alexa built-in Zigbee hub, SmartThings, Philips Hue, SONOFF ZBBridge Pro. Sunrise/sunset routines. V0 flame-retardant, varistor, fuse protection.`,
    sourceUrl: "https://us.itead.cc/us/products/sonoff-zigbee-smart-plug-iplug-lite",
    features: [
      "15A / 1800W, Zigbee router",
      "Alexa, SmartThings, Hue, ZBBridge Pro",
      "Sunrise/sunset routines, safe enclosure",
    ],
  },
  {
    name: "SONOFF Zigbee Smart Water Valve",
    slug: "sonoff-zigbee-smart-water-valve",
    priceCents: 2690,
    description: `Connect between faucet and hose to automate watering (lawn, garden, vegetable patch). Schedule and capacity modes, single and cyclic irrigation. 20-month battery (e.g. 1h/day). Low-water notification. Up to 180 days usage history in app. Voice control (Alexa, Google Home). Works with ZBDongle-P/E for open-source platforms.`,
    sourceUrl: "https://us.itead.cc/us/products/sonoff-zigbee-smart-water-valve",
    features: [
      "Schedule + capacity modes, cyclic irrigation",
      "20-month battery, low-water alert",
      "180-day usage history, voice control",
    ],
  },
];

async function createProduct(input: ProductInput) {
  const res = await fetch(`${API_BASE}/api/admin/products`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: input.name,
      slug: input.slug,
      priceCents: input.priceCents,
      description: input.description,
      brand: "Sonoff",
      vendor: "SONOFF / ITEAD",
      published: true,
      physicalProduct: true,
      trackQuantity: false,
      features: input.features ?? [],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Product ${input.name}: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { id: string; name: string };
  console.log("Created product:", json.name, json.id);
  return json.id;
}

async function main() {
  console.log("API base:", API_BASE);
  await createBrand();
  for (const p of PRODUCTS) {
    await createProduct(p);
  }
  console.log("Done. Sonoff brand and 7 products added.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
