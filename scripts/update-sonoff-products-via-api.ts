/**
 * Update existing Sonoff products with full listing data via admin API:
 * images, image SEO (alt/title), country of origin, markets, categories,
 * meta description, page title.
 *
 * Usage:
 *   cd ftc
 *   MAIN_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> bun run scripts/update-sonoff-products-via-api.ts
 */

const MAIN_APP_URL =
  process.env.MAIN_APP_URL?.trim() || "https://forthecult.store";
const API_KEY =
  process.env.ADMIN_AI_API_KEY?.trim() || process.env.ADMIN_API_KEY?.trim();
if (!API_KEY) {
  console.error(
    "Set ADMIN_AI_API_KEY or ADMIN_API_KEY. Optionally MAIN_APP_URL.",
  );
  process.exit(1);
}

const API_BASE = MAIN_APP_URL.replace(/\/$/, "");
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

// Markets: same as POD (API will filter excluded). ISO 3166-1 alpha-2.
const AVAILABLE_COUNTRY_CODES = [
  "US",
  "CA",
  "MX",
  "GT",
  "DO",
  "HN",
  "NI",
  "SV",
  "CR",
  "PA",
  "JM",
  "TT",
  "BZ",
  "BS",
  "BB",
  "AG",
  "DM",
  "GD",
  "KN",
  "LC",
  "VC",
  "BR",
  "AR",
  "CO",
  "PE",
  "VE",
  "CL",
  "UY",
  "GB",
  "DE",
  "FR",
  "IT",
  "ES",
  "NL",
  "BE",
  "AT",
  "CH",
  "PL",
  "SE",
  "NO",
  "DK",
  "FI",
  "IE",
  "PT",
  "CZ",
  "RO",
  "HU",
  "GR",
  "BG",
  "HR",
  "SK",
  "RS",
  "LT",
  "LV",
  "EE",
  "SI",
  "LU",
  "MT",
  "CY",
  "IS",
  "LI",
  "AL",
  "MK",
  "ME",
  "BA",
  "MD",
  "TR",
  "ZA",
  "EG",
  "KE",
  "MA",
  "TZ",
  "TN",
  "CN",
  "JP",
  "IN",
  "KR",
  "TH",
  "VN",
  "MY",
  "SG",
  "HK",
  "TW",
  "AE",
  "SA",
  "IL",
  "LK",
  "QA",
  "KW",
  "BH",
  "OM",
  "JO",
  "KZ",
  "UZ",
  "GE",
  "AZ",
  "AM",
  "AU",
  "NZ",
];

interface ProductUpdate {
  slug: string;
  imageUrl: string;
  mainImageAlt: string;
  mainImageTitle: string;
  images: Array<{ url: string; alt: string; title: string }>;
  metaDescription: string;
  pageTitle: string;
  countryOfOrigin: string;
}

const UPDATES_BY_SLUG: Record<string, ProductUpdate> = {
  "sonoff-zigbee-wireless-switch-snzb-01p": {
    slug: "sonoff-zigbee-wireless-switch-snzb-01p",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0742/9963/8001/files/SNZB-01P_01.jpg",
    mainImageAlt:
      "SONOFF SNZB-01P Zigbee wireless switch - compact smart button for single, double, long press",
    mainImageTitle:
      "SONOFF Zigbee Wireless Switch SNZB-01P | Smart Home | Culture",
    images: [
      {
        url: "https://cdn.shopify.com/s/files/1/0742/9963/8001/files/SNZB-01P_01.jpg",
        alt: "SONOFF SNZB-01P Zigbee wireless switch",
        title: "SONOFF SNZB-01P - Main",
      },
      {
        url: "https://cdn.shopify.com/s/files/1/0742/9963/8001/files/SNZB-01P_02.jpg",
        alt: "SONOFF SNZB-01P wireless switch - button and mounting",
        title: "SONOFF SNZB-01P - Mounting",
      },
    ],
    metaDescription:
      "SONOFF SNZB-01P Zigbee wireless switch. Custom single/double/long press. Zigbee 3.0, 5-year battery. Smart home, doorbell, Alexa. Buy at Culture.",
    pageTitle:
      "SONOFF Zigbee Wireless Switch (SNZB-01P) | Smart Home | Culture",
    countryOfOrigin: "China",
  },
  "sonoff-zigbee-motion-sensor-snzb-03p": {
    slug: "sonoff-zigbee-motion-sensor-snzb-03p",
    imageUrl: "https://us.itead.cc/wp-content/uploads/2024/01/SNZB-03P-1.jpg",
    mainImageAlt:
      "SONOFF SNZB-03P Zigbee motion sensor - low-power PIR for lights and security",
    mainImageTitle:
      "SONOFF SNZB-03P Zigbee Motion Sensor | Smart Home | Culture",
    images: [
      {
        url: "https://us.itead.cc/wp-content/uploads/2024/01/SNZB-03P-1.jpg",
        alt: "SONOFF SNZB-03P Zigbee motion sensor",
        title: "SONOFF SNZB-03P - Main",
      },
    ],
    metaDescription:
      "SONOFF SNZB-03P Zigbee motion sensor. 5s detection, 3-year battery. Corridors, entrances, security. Local scenes. Buy at Culture.",
    pageTitle: "SONOFF SNZB-03P Zigbee Motion Sensor | Smart Home | Culture",
    countryOfOrigin: "China",
  },
  "sonoff-zigbee-door-window-sensor-snzb-04p": {
    slug: "sonoff-zigbee-door-window-sensor-snzb-04p",
    imageUrl: "https://us.itead.cc/wp-content/uploads/2024/01/SNZB-04P-1.jpg",
    mainImageAlt:
      "SONOFF SNZB-04P Zigbee door/window sensor - tamper-proof, 5-year battery",
    mainImageTitle:
      "SONOFF SNZB-04P Zigbee Door/Window Sensor | Smart Home | Culture",
    images: [
      {
        url: "https://us.itead.cc/wp-content/uploads/2024/01/SNZB-04P-1.jpg",
        alt: "SONOFF SNZB-04P Zigbee door window sensor",
        title: "SONOFF SNZB-04P - Main",
      },
    ],
    metaDescription:
      "SONOFF SNZB-04P Zigbee door/window sensor. Tamper alert, 5-year battery, 20mm gap. Lights and alarms. Buy at Culture.",
    pageTitle:
      "SONOFF SNZB-04P Zigbee Door/Window Sensor | Smart Home | Culture",
    countryOfOrigin: "China",
  },
  "sonoff-zigbee-temperature-humidity-sensor-snzb-02p": {
    slug: "sonoff-zigbee-temperature-humidity-sensor-snzb-02p",
    imageUrl: "https://us.itead.cc/wp-content/uploads/2024/01/SNZB-02P-1.jpg",
    mainImageAlt:
      "SONOFF SNZB-02P Zigbee temperature and humidity sensor - Swiss sensor ±0.2°C",
    mainImageTitle:
      "SONOFF SNZB-02P Temperature & Humidity Sensor | Smart Home | Culture",
    images: [
      {
        url: "https://us.itead.cc/wp-content/uploads/2024/01/SNZB-02P-1.jpg",
        alt: "SONOFF SNZB-02P temperature humidity sensor",
        title: "SONOFF SNZB-02P - Main",
      },
    ],
    metaDescription:
      "SONOFF SNZB-02P Zigbee temperature and humidity sensor. Swiss sensor, ±0.2°C, comfort alerts, 4-year battery. Buy at Culture.",
    pageTitle:
      "SONOFF SNZB-02P Zigbee Temperature & Humidity Sensor | Smart Home | Culture",
    countryOfOrigin: "China",
  },
  "sonoff-l3-pro-rgbic-smart-led-strip-lights": {
    slug: "sonoff-l3-pro-rgbic-smart-led-strip-lights",
    imageUrl:
      "https://us.itead.cc/wp-content/uploads/2024/06/L3-Pro-RGBIC-1.jpg",
    mainImageAlt:
      "SONOFF L3 Pro RGBIC smart LED strip 5m - multiple colors, music sync, voice control",
    mainImageTitle:
      "SONOFF L3 Pro RGBIC Smart LED Strip 5M | Smart Home | Culture",
    images: [
      {
        url: "https://us.itead.cc/wp-content/uploads/2024/06/L3-Pro-RGBIC-1.jpg",
        alt: "SONOFF L3 Pro RGBIC LED strip lights",
        title: "SONOFF L3 Pro RGBIC - Main",
      },
    ],
    metaDescription:
      "SONOFF L3 Pro RGBIC smart LED strip 5m. 44 effects, music mode, Alexa/Google. Local control. Buy at Culture.",
    pageTitle:
      "SONOFF L3 Pro RGBIC Smart LED Strip Lights 5M | Smart Home | Culture",
    countryOfOrigin: "China",
  },
  "sonoff-zigbee-smart-plug-iplug-s40-lite": {
    slug: "sonoff-zigbee-smart-plug-iplug-s40-lite",
    imageUrl:
      "https://us.itead.cc/wp-content/uploads/2025/01/S40-Lite-Zigbee-1.jpg",
    mainImageAlt:
      "SONOFF Zigbee smart plug S40 Lite - 15A 1800W, Zigbee router",
    mainImageTitle: "SONOFF Zigbee Smart Plug S40 Lite | Smart Home | Culture",
    images: [
      {
        url: "https://us.itead.cc/wp-content/uploads/2025/01/S40-Lite-Zigbee-1.jpg",
        alt: "SONOFF S40 Lite Zigbee smart plug",
        title: "SONOFF S40 Lite - Main",
      },
    ],
    metaDescription:
      "SONOFF Zigbee smart plug S40 Lite. 15A/1800W, Zigbee router. Alexa, SmartThings, Hue. Buy at Culture.",
    pageTitle:
      "SONOFF Zigbee Smart Plug (iPlug S40 Lite) | Smart Home | Culture",
    countryOfOrigin: "China",
  },
  "sonoff-zigbee-smart-water-valve": {
    slug: "sonoff-zigbee-smart-water-valve",
    imageUrl:
      "https://us.itead.cc/wp-content/uploads/2024/08/Zigbee-Smart-Water-Valve-1.jpg",
    mainImageAlt:
      "SONOFF Zigbee smart water valve - automated irrigation, schedule and capacity modes",
    mainImageTitle: "SONOFF Zigbee Smart Water Valve | Smart Home | Culture",
    images: [
      {
        url: "https://us.itead.cc/wp-content/uploads/2024/08/Zigbee-Smart-Water-Valve-1.jpg",
        alt: "SONOFF Zigbee smart water valve",
        title: "SONOFF Smart Water Valve - Main",
      },
    ],
    metaDescription:
      "SONOFF Zigbee smart water valve. Automate watering, schedule and capacity modes, 180-day history. Buy at Culture.",
    pageTitle: "SONOFF Zigbee Smart Water Valve | Smart Home | Culture",
    countryOfOrigin: "China",
  },
};

async function main() {
  // 1. Get categories and find smart-home
  const catRes = await fetch(`${API_BASE}/api/admin/categories?limit=200`, {
    headers,
  });
  if (!catRes.ok) throw new Error(`Categories: ${catRes.status}`);
  const catData = (await catRes.json()) as {
    items?: Array<{ id: string; slug: string; name: string }>;
  };
  const smartHome = (catData.items ?? []).find(
    (c) => c.slug === "smart-home" || c.id === "smart-home",
  );
  const categoryId = smartHome?.id ?? "smart-home";
  console.log("Category smart-home:", categoryId);

  // 2. Get Sonoff products
  const listRes = await fetch(
    `${API_BASE}/api/admin/products?search=Sonoff&limit=20`,
    { headers },
  );
  if (!listRes.ok) throw new Error(`Products list: ${listRes.status}`);
  const listData = (await listRes.json()) as {
    items?: Array<{ id: string; slug?: string; name: string }>;
  };
  const products = listData.items ?? [];
  if (products.length === 0) {
    console.log("No Sonoff products found. Run seed-sonoff-via-api.ts first.");
    return;
  }

  for (const product of products) {
    const slug = (product.slug ?? product.id).trim();
    const update = UPDATES_BY_SLUG[slug];
    if (!update) {
      console.log("Skip (no update data):", product.name, slug);
      continue;
    }

    const body = {
      imageUrl: update.imageUrl,
      mainImageAlt: update.mainImageAlt,
      mainImageTitle: update.mainImageTitle,
      images: update.images.map((img, i) => ({
        url: img.url,
        alt: img.alt,
        title: img.title,
        sortOrder: i,
      })),
      metaDescription: update.metaDescription,
      pageTitle: update.pageTitle,
      countryOfOrigin: update.countryOfOrigin,
      availableCountryCodes: AVAILABLE_COUNTRY_CODES,
      categoryIds: [categoryId],
      mainCategoryId: categoryId,
    };

    const patchRes = await fetch(
      `${API_BASE}/api/admin/products/${product.id}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      },
    );

    if (!patchRes.ok) {
      const text = await patchRes.text();
      console.error(
        `PATCH ${product.name} (${product.id}): ${patchRes.status} ${text}`,
      );
      continue;
    }

    console.log("Updated:", product.name);
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(
    "Done. Sonoff product listings updated with images, SEO, origin, markets, and categories.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
