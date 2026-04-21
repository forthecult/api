/**
 * Fetch Minirig product images from minirigs.co.uk, upload to our CDN (UploadThing)
 * via the admin upload API, then PATCH each Minirig product so all images
 * (product gallery + variant images) come from our domain.
 *
 * Usage:
 *   MAIN_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> bun run scripts/minirig-images-to-cdn.ts
 *
 * Production must have: (1) latest admin upload route, (2) UPLOADTHING_TOKEN set.
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

const SITES_LARGE =
  "https://minirigs.co.uk/sites/default/files/styles/large/public/2026-01";
const SITES_12 =
  "https://minirigs.co.uk/sites/default/files/styles/large/public/2025-12";
const SITES_11 =
  "https://minirigs.co.uk/sites/default/files/styles/large/public/2025-11";

type ImageSpec = { url: string; alt: string; title: string };
type ProductSpec = {
  slug: string;
  mainImageAlt: string;
  mainImageTitle: string;
  images: ImageSpec[];
  variantImageByColor: Record<string, string>;
};

const MINIRIG_4: ProductSpec = {
  slug: "minirig-4-bluetooth-speaker",
  mainImageAlt:
    "Minirig 4 Bluetooth Speaker - portable wireless speaker, Bristol UK",
  mainImageTitle: "Minirig 4 Bluetooth Speaker | Portable Bluetooth Speaker",
  images: [
    {
      url: `${SITES_LARGE}/minirig-4-black.webp?itok=Sz1POk6h`,
      alt: "Minirig 4 Bluetooth Speaker Black - portable wireless speaker, designed in Bristol UK",
      title: "Minirig 4 Bluetooth Speaker - Black",
    },
    {
      url: `${SITES_LARGE}/minirig-4-black-top-cap.webp?itok=2YpnK93c`,
      alt: "Minirig 4 Black grille and top cap",
      title: "Minirig 4 - Grille",
    },
    {
      url: `${SITES_LARGE}/minirig-4-bottom-cap.webp?itok=w5op-ysf`,
      alt: "Minirig 4 bottom cap and controls",
      title: "Minirig 4 - Bottom",
    },
    {
      url: `${SITES_LARGE}/minirig-4-case-open.webp?itok=Sh4PRn1k`,
      alt: "Minirig 4 with protective travel case open",
      title: "Minirig 4 - Case open",
    },
    {
      url: `${SITES_LARGE}/minirig-4-case-closed.webp?itok=SedEPEDw`,
      alt: "Minirig 4 travel case closed",
      title: "Minirig 4 - Case closed",
    },
    {
      url: `${SITES_LARGE}/minirig-4-charger-cable.webp?itok=hnH4dDPD`,
      alt: "Minirig 4 USB-C charging cable",
      title: "Minirig 4 - Charger cable",
    },
    {
      url: `${SITES_LARGE}/minirig-4-packaging.webp?itok=Oa2kYqSz`,
      alt: "Minirig 4 eco-friendly recycled packaging",
      title: "Minirig 4 - Packaging",
    },
  ],
  variantImageByColor: {
    Black: `${SITES_LARGE}/minirig-4-black.webp?itok=Sz1POk6h`,
    Blue: `${SITES_LARGE}/minirig-4-blue.webp?itok=s7BbIhfE`,
    "Brushed Silver": `${SITES_LARGE}/minirig-4-brushed-silver.webp?itok=00TzdmUL`,
    Green: `${SITES_LARGE}/minirig-4-green.webp?itok=gik6ylsA`,
    Red: `${SITES_LARGE}/minirig-4-red.webp?itok=A4ATy2Gb`,
  },
};

const MINIRIG_SUBWOOFER_4: ProductSpec = {
  slug: "minirig-subwoofer-4",
  mainImageAlt: "Minirig Subwoofer 4 - portable wireless subwoofer, Bristol UK",
  mainImageTitle: "Minirig Subwoofer 4 | Portable Subwoofer",
  images: [
    {
      url: `${SITES_12}/black-sub-4.webp?itok=6EtSzO36`,
      alt: "Minirig Subwoofer 4 Black - portable wireless subwoofer, Bristol UK",
      title: "Minirig Subwoofer 4 - Black",
    },
    {
      url: `${SITES_12}/topview-black-sub-4.webp?itok=UQ1Hvnfd`,
      alt: "Minirig Subwoofer 4 grille top view",
      title: "Minirig Subwoofer 4 - Grille",
    },
    {
      url: `${SITES_12}/port-view-sub-4.webp?itok=wns2zoI6`,
      alt: "Minirig Subwoofer 4 port view",
      title: "Minirig Subwoofer 4 - Port",
    },
    {
      url: `${SITES_12}/Subwoofer%204%20-%20product%20-%20Mailchimp%20%281%29.png.webp?itok=QxwBrvw4`,
      alt: "Minirig Subwoofer 4 in the box",
      title: "Minirig Subwoofer 4 - In the box",
    },
  ],
  variantImageByColor: {
    Black: `${SITES_11}/black-sub-4.webp?itok=2LnqDOgl`,
    Blue: `${SITES_11}/blue-sub-4.webp?itok=4-NXIT3T`,
    "Brushed Silver": `${SITES_11}/brushed-sub-4.webp?itok=P5nxiI7f`,
    Green: `${SITES_11}/green-sub-4.webp?itok=MVoTu7Mx`,
    Purple: `${SITES_11}/purple-sub-4.webp?itok=1WQ879_q`,
    Red: `${SITES_11}/red-sub-4.webp?itok=Ac7_xGHj`,
  },
};

const SPECS_BY_SLUG: Record<string, ProductSpec> = {
  "minirig-4-bluetooth-speaker": MINIRIG_4,
  "minirig-subwoofer-4": MINIRIG_SUBWOOFER_4,
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

function fetchOptionsForUrl(url: string): RequestInit {
  const isMinirigs = url.includes("minirigs.co.uk");
  return {
    headers: {
      Accept: "image/*",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ...(isMinirigs ? { Referer: "https://minirigs.co.uk/" } : {}),
    },
    signal: AbortSignal.timeout(15000),
  };
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
      : "image/webp";
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

/** Resolve every unique source URL to a CDN URL (fetch + upload if not already our CDN). */
async function resolveUrlsToCdn(
  urls: string[],
  slug: string,
  label: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const seen = new Set<string>();
  let index = 0;
  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    if (isOurCdn(url)) {
      map.set(url, url);
      continue;
    }
    const data = await fetchImageBuffer(url);
    if (!data) {
      console.warn(`  Could not fetch ${label}: ${url.slice(0, 60)}...`);
      continue;
    }
    const filename = `minirig-${slug.replace(/^minirig-/, "")}-${index}`;
    const cdnUrl = await uploadToCdn(data.buffer, data.type, filename);
    if (cdnUrl) {
      map.set(url, cdnUrl);
      console.log("  Uploaded:", filename, "→", `${cdnUrl.slice(0, 50)}...`);
      index += 1;
    }
  }
  return map;
}

async function main() {
  const listRes = await fetch(
    `${API_BASE}/api/admin/products?search=Minirig&limit=20`,
    { headers },
  );
  if (!listRes.ok)
    throw new Error(`Products: ${listRes.status} ${await listRes.text()}`);
  const listData = (await listRes.json()) as {
    items?: Array<{ id: string; slug?: string; name: string }>;
  };
  const products = listData.items ?? [];
  let updatedCount = 0;

  for (const product of products) {
    const slug = (product.slug ?? "").trim();
    const spec = SPECS_BY_SLUG[slug];
    if (!spec) {
      console.log("Skip (no spec):", product.name);
      continue;
    }

    const allUrls = [
      ...spec.images.map((i) => i.url),
      ...Object.values(spec.variantImageByColor),
    ];
    const urlToCdn = await resolveUrlsToCdn(allUrls, slug, product.name);
    if (urlToCdn.size === 0) {
      console.warn("  No images resolved for", product.name);
      continue;
    }

    const resolve = (u: string) => urlToCdn.get(u) ?? u;
    const newImageUrl = resolve(spec.images[0]!.url);
    const newImages = spec.images.map((img) => ({
      url: resolve(img.url),
      alt: img.alt,
      title: img.title,
    }));

    const getRes = await fetch(`${API_BASE}/api/admin/products/${product.id}`, {
      headers,
    });
    if (!getRes.ok) {
      console.error("  GET product failed:", getRes.status);
      continue;
    }
    const current = (await getRes.json()) as {
      variants?: Array<{
        id: string;
        color?: string | null;
        priceCents: number;
        sku?: string | null;
      }>;
    };
    const existingVariants = current.variants ?? [];

    const productLabel = slug.includes("subwoofer")
      ? "Subwoofer 4"
      : "4 Bluetooth Speaker";
    const variants = existingVariants.map((v) => {
      const color = (v.color ?? "").trim();
      const sourceUrl = color ? spec.variantImageByColor[color] : null;
      const imageUrl = sourceUrl
        ? (urlToCdn.get(sourceUrl) ?? sourceUrl)
        : undefined;
      return {
        id: v.id,
        color: v.color ?? null,
        priceCents: v.priceCents,
        sku: v.sku ?? null,
        imageUrl: imageUrl ?? undefined,
        imageAlt: color ? `Minirig ${productLabel}, ${color}` : undefined,
        imageTitle: color
          ? slug.includes("subwoofer")
            ? `Minirig Subwoofer 4 - ${color}`
            : `Minirig 4 - ${color}`
          : undefined,
      };
    });

    const body = {
      imageUrl: newImageUrl,
      mainImageAlt: spec.mainImageAlt,
      mainImageTitle: spec.mainImageTitle,
      images: newImages.map((img, i) => ({
        url: img.url,
        alt: img.alt,
        title: img.title,
        sortOrder: i,
      })),
      variants,
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
      console.error("  PATCH failed:", patchRes.status, await patchRes.text());
      continue;
    }
    updatedCount += 1;
    console.log(
      "Updated",
      product.name,
      "with",
      newImages.length,
      "image(s) + variant images from our CDN.",
    );
    await new Promise((r) => setTimeout(r, 600));
  }

  if (updatedCount > 0) {
    console.log(
      "Done. Minirig images are now on our CDN (" +
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
