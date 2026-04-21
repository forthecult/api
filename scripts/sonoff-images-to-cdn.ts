/**
 * Fetch each Sonoff product image from source URLs (sonoff.tech CDN, then ITEAD fallback),
 * upload to our CDN (UploadThing) via the admin upload API, then PATCH each product so
 * all images come from our CDN with SEO alt/title.
 *
 * Usage:
 *   MAIN_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> bun run scripts/sonoff-images-to-cdn.ts
 *
 * Production must have: (1) latest admin upload route (reads UploadThing response shape correctly),
 * (2) UPLOADTHING_TOKEN set in env. If uploads return 500, deploy the ftc app and re-run.
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

/** Fetch options: Referer from sonoff.tech so their CDN allows the request. */
function fetchOptionsForUrl(url: string): RequestInit {
  const isSonoff = url.includes("sonoff.tech");
  return {
    headers: {
      Accept: "image/*",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ...(isSonoff ? { Referer: "https://sonoff.tech/" } : {}),
    },
    signal: AbortSignal.timeout(15000),
  };
}

/** sonoff.tech CDN (use Referer: https://sonoff.tech/). ITEAD as fallback. */
const SONOFF_CDN = "https://sonoff.tech/cdn/shop/files";
const ITEAD = "https://us.itead.cc/wp-content/uploads";

type ImageSpec = {
  urls: string[];
  alt: string;
  title: string;
  /** SEO: use as mainImageAlt for the primary image (first spec) */
  mainImageAlt?: string;
  /** SEO: use as mainImageTitle for the primary image (first spec) */
  mainImageTitle?: string;
};

const IMAGE_SPECS: Record<string, ImageSpec[]> = {
  "sonoff-zigbee-wireless-switch-snzb-01p": [
    {
      urls: [
        `${SONOFF_CDN}/SNZB-01P_Zigbee.png?v=1751008428`,
        `${ITEAD}/2024/01/SNZB-01P-1.jpg`,
      ],
      alt: "SONOFF SNZB-01P Zigbee wireless switch",
      title: "SONOFF SNZB-01P - Main",
      mainImageAlt:
        "SONOFF SNZB-01P Zigbee wireless switch - compact smart button for single, double, long press",
      mainImageTitle:
        "SONOFF Zigbee Wireless Switch SNZB-01P | Smart Home | Culture",
    },
    {
      urls: [
        `${SONOFF_CDN}/sonoff-zigbee-wireless-switch-snzb-01p-4.jpg?v=1751008428`,
        `${ITEAD}/2024/01/SNZB-01P_02.jpg`,
      ],
      alt: "SONOFF SNZB-01P wireless switch - button and mounting",
      title: "SONOFF SNZB-01P - Mounting",
    },
  ],
  "sonoff-zigbee-motion-sensor-snzb-03p": [
    {
      urls: [
        `${SONOFF_CDN}/SNZB-03P_Zigbee.png?v=1751008394`,
        `${ITEAD}/2024/01/SNZB-03P-1.jpg`,
      ],
      alt: "SONOFF SNZB-03P Zigbee motion sensor",
      title: "SONOFF SNZB-03P - Main",
      mainImageAlt:
        "SONOFF SNZB-03P Zigbee motion sensor - low-power PIR for lights and security",
      mainImageTitle:
        "SONOFF SNZB-03P Zigbee Motion Sensor | Smart Home | Culture",
    },
  ],
  "sonoff-zigbee-door-window-sensor-snzb-04p": [
    {
      urls: [
        `${SONOFF_CDN}/SNZB-04P_3ecebce5-6f5f-4657-9d34-dc292e699965.png?v=1751008379`,
        `${ITEAD}/2024/01/SNZB-04P-1.jpg`,
      ],
      alt: "SONOFF SNZB-04P Zigbee door window sensor",
      title: "SONOFF SNZB-04P - Main",
      mainImageAlt:
        "SONOFF SNZB-04P Zigbee door/window sensor - tamper-proof, 5-year battery",
      mainImageTitle:
        "SONOFF SNZB-04P Zigbee Door/Window Sensor | Smart Home | Culture",
    },
  ],
  "sonoff-zigbee-temperature-humidity-sensor-snzb-02p": [
    {
      urls: [
        `${SONOFF_CDN}/SNZB-02P.png?v=1751008416`,
        `${ITEAD}/2024/01/SNZB-02P-1.jpg`,
      ],
      alt: "SONOFF SNZB-02P temperature humidity sensor",
      title: "SONOFF SNZB-02P - Main",
      mainImageAlt:
        "SONOFF SNZB-02P Zigbee temperature and humidity sensor - Swiss sensor ±0.2°C",
      mainImageTitle:
        "SONOFF SNZB-02P Temperature & Humidity Sensor | Smart Home | Culture",
    },
  ],
  "sonoff-l3-pro-rgbic-smart-led-strip-lights": [
    {
      urls: [
        `${SONOFF_CDN}/L3-Pro-RGBIC.png?v=1751008522`,
        `${SONOFF_CDN}/L3-Pro-RGBIC.png`,
        `${ITEAD}/2024/06/L3-Pro-RGBIC-1.jpg`,
      ],
      alt: "SONOFF L3 Pro RGBIC LED strip lights",
      title: "SONOFF L3 Pro RGBIC - Main",
      mainImageAlt:
        "SONOFF L3 Pro RGBIC smart LED strip 5m - multiple colors, music sync, voice control",
      mainImageTitle:
        "SONOFF L3 Pro RGBIC Smart LED Strip 5M | Smart Home | Culture",
    },
  ],
  "sonoff-zigbee-smart-plug-iplug-s40-lite": [
    {
      urls: [
        `${SONOFF_CDN}/S60ZB.jpg?v=1751264859`,
        `${SONOFF_CDN}/S31-Lite-zb.jpg?v=1751264594`,
        `${ITEAD}/2025/01/S40-Lite-Zigbee-1.jpg`,
      ],
      alt: "SONOFF Zigbee smart plug S40 Lite",
      title: "SONOFF S40 Lite - Main",
      mainImageAlt:
        "SONOFF Zigbee smart plug S40 Lite - 15A 1800W, Zigbee router",
      mainImageTitle:
        "SONOFF Zigbee Smart Plug S40 Lite | Smart Home | Culture",
    },
  ],
  "sonoff-zigbee-smart-water-valve": [
    {
      urls: [
        `${SONOFF_CDN}/SWV.png?v=1751008511`,
        `${ITEAD}/2024/08/Zigbee-Smart-Water-Valve-1.jpg`,
      ],
      alt: "SONOFF Zigbee smart water valve",
      title: "SONOFF Smart Water Valve - Main",
      mainImageAlt:
        "SONOFF Zigbee smart water valve - automated irrigation, schedule and capacity modes",
      mainImageTitle: "SONOFF Zigbee Smart Water Valve | Smart Home | Culture",
    },
  ],
};

function isOurCdn(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return (
      h.includes("utfs.io") || h.includes("ufs.sh") || h.includes("uploadthing")
    );
  } catch {
    return false;
  }
}

async function fetchImageBuffer(
  url: string,
): Promise<{ buffer: ArrayBuffer; type: string } | null> {
  try {
    const res = await fetch(url, fetchOptionsForUrl(url));
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (ct.startsWith("text/") || ct.includes("html")) return null;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 500) return null;
    const type = ct.startsWith("image/")
      ? ct.split(";")[0]!.trim()
      : "image/jpeg";
    return { buffer, type };
  } catch {
    return null;
  }
}

async function uploadToCdn(
  buffer: ArrayBuffer,
  mimeType: string,
  filename: string,
): Promise<string | null> {
  const ext =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : "jpg";
  const file = new File(
    [buffer],
    filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`,
    {
      type: mimeType,
    },
  );
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/admin/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("  Upload failed:", res.status, err.slice(0, 200));
    return null;
  }
  const data = (await res.json()) as { url?: string };
  return data.url ?? null;
}

async function main() {
  const listRes = await fetch(
    `${API_BASE}/api/admin/products?search=Sonoff&limit=20`,
    {
      headers: { Authorization: `Bearer ${API_KEY}` },
    },
  );
  if (!listRes.ok) throw new Error(`Products: ${listRes.status}`);
  const listData = (await listRes.json()) as {
    items?: Array<{ id: string; slug?: string; name: string }>;
  };
  const products = listData.items ?? [];
  let updatedCount = 0;

  for (const product of products) {
    const slug = (product.slug ?? "").trim();
    const specs = IMAGE_SPECS[slug];
    if (!specs?.length) {
      console.log("Skip (no image specs):", product.name);
      continue;
    }

    const newImages: Array<{ url: string; alt: string; title: string }> = [];
    const firstSpec = specs[0];
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i]!;
      let data: { buffer: ArrayBuffer; type: string } | null = null;
      for (const url of spec.urls) {
        if (isOurCdn(url)) {
          newImages.push({ url, alt: spec.alt, title: spec.title });
          data = null;
          break;
        }
        data = await fetchImageBuffer(url);
        if (data) break;
      }
      if (!data && !newImages.some((img) => img.alt === spec.alt)) {
        console.warn(
          `  Could not fetch image for ${product.name}: ${spec.title}`,
        );
        continue;
      }
      if (data) {
        const name = slug.replace(/^sonoff-/, "") + (i > 0 ? `-${i}` : "");
        const cdnUrl = await uploadToCdn(
          data.buffer,
          data.type,
          `sonoff-${name}`,
        );
        if (cdnUrl) {
          newImages.push({ url: cdnUrl, alt: spec.alt, title: spec.title });
          console.log(
            "  Uploaded:",
            spec.title,
            "→",
            `${cdnUrl.slice(0, 50)}...`,
          );
        }
      }
    }

    if (newImages.length === 0) {
      console.warn("  No images for", product.name);
      continue;
    }

    // SEO: use mainImageAlt/mainImageTitle from first spec when set
    const mainAlt = firstSpec?.mainImageAlt ?? newImages[0]!.alt;
    const mainTitle = firstSpec?.mainImageTitle ?? newImages[0]!.title;

    const patchRes = await fetch(
      `${API_BASE}/api/admin/products/${product.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          imageUrl: newImages[0]!.url,
          mainImageAlt: mainAlt,
          mainImageTitle: mainTitle,
          images: newImages.map((img, i) => ({
            url: img.url,
            alt: img.alt,
            title: img.title,
            sortOrder: i,
          })),
        }),
      },
    );

    if (!patchRes.ok) {
      console.error("  PATCH failed:", patchRes.status, await patchRes.text());
      continue;
    }
    updatedCount += 1;
    console.log(
      "Updated",
      product.name,
      "with",
      newImages.length,
      "image(s) from our CDN.",
    );
    await new Promise((r) => setTimeout(r, 600));
  }

  if (updatedCount > 0) {
    console.log(
      "Done. Sonoff images are now on our CDN (" +
        updatedCount +
        " product(s) updated).",
    );
  } else {
    console.error(
      "Done. No products were updated. If uploads returned 500, deploy the latest admin upload route and ensure UPLOADTHING_TOKEN is set in production, then re-run this script.",
    );
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
