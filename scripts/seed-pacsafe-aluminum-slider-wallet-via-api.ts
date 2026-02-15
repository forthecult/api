/**
 * Add Pacsafe RFIDsafe® RFID blocking aluminum slider wallet via admin API.
 * Fetches images from Pacsafe (Shopify), uploads to UploadThing, creates product with SEO.
 *
 * Product: https://pacsafe.com/collections/accessories-locks/products/rfid-blocking-aluminum-slider-wallet
 *
 * Usage:
 *   cd ftc && MAIN_APP_URL=https://forthecult.store bun run scripts/seed-pacsafe-aluminum-slider-wallet-via-api.ts
 */

import "dotenv/config";

const MAIN_APP_URL =
  process.env.MAIN_APP_URL?.trim() || "https://forthecult.store";
const API_KEY =
  process.env.ADMIN_AI_API_KEY?.trim() || process.env.ADMIN_API_KEY?.trim();
if (!API_KEY) {
  console.error("Set ADMIN_AI_API_KEY or ADMIN_API_KEY in .env");
  process.exit(1);
}

const API_BASE = MAIN_APP_URL.replace(/\/$/, "");
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

const PRODUCT_JSON =
  "https://pacsafe.com/products/rfid-blocking-aluminum-slider-wallet.json";

type ShopifyImage = { src: string; alt: string | null; position: number };

async function fetchImageBuffer(
  url: string,
): Promise<{ buffer: ArrayBuffer; mimeType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "image/*",
        "User-Agent": "Mozilla/5.0 (compatible; CultureBot/1.0)",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "";
    const mimeType = contentType.startsWith("image/")
      ? contentType.split(";")[0]!.trim()
      : "image/jpeg";
    return { buffer, mimeType };
  } catch {
    return null;
  }
}

async function uploadToUploadThing(
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
  const name = filename.replace(/\.[^.]+$/, "") || "image";
  const file = new File(
    [buffer],
    name.endsWith(`.${ext}`) ? name : `${name}.${ext}`,
    { type: mimeType },
  );
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/admin/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: formData,
  });
  if (!res.ok) {
    console.warn("  Upload failed:", res.status);
    return null;
  }
  const data = (await res.json()) as { url?: string };
  return data.url ?? null;
}

async function getImagesFromPacsafe(): Promise<
  Array<{ url: string; alt: string; title: string }>
> {
  const res = await fetch(PRODUCT_JSON, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { product?: { images?: ShopifyImage[] } };
  const images = (data.product?.images ?? []).sort(
    (a, b) => a.position - b.position,
  );
  const result: Array<{ url: string; alt: string; title: string }> = [];
  const productName = "RFIDsafe® RFID blocking aluminum slider wallet";
  const pageTitle =
    "RFIDsafe® RFID Blocking Aluminum Slider Wallet | Pacsafe | Culture";
  for (let i = 0; i < images.length; i++) {
    const img = images[i]!;
    const data = await fetchImageBuffer(img.src);
    if (!data) continue;
    const cdnUrl = await uploadToUploadThing(
      data.buffer,
      data.mimeType,
      `pacsafe-aluminum-slider-wallet-${i + 1}`,
    );
    if (cdnUrl) {
      const alt = img.alt?.trim() || `${productName}, Dark Grey`;
      const title = i === 0 ? pageTitle : `${productName} — ${alt}`;
      result.push({ url: cdnUrl, alt, title });
      console.log("  Uploaded image", i + 1, "→ UploadThing");
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return result;
}

async function getCategoryIdWallets(): Promise<string | null> {
  const res = await fetch(`${API_BASE}/api/admin/categories?limit=300`, {
    headers,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    items?: Array<{ id: string; slug?: string }>;
  };
  const wallets = (data.items ?? []).find(
    (c) => c.slug === "wallets" || c.id === "accessories-wallets",
  );
  return wallets?.id ?? null;
}

async function main() {
  console.log("API base:", API_BASE);
  console.log("Fetching product images from Pacsafe...");
  const images = await getImagesFromPacsafe();
  if (images.length === 0) {
    console.error("No images could be fetched/uploaded.");
    process.exit(1);
  }
  const categoryId = await getCategoryIdWallets();
  if (!categoryId)
    console.warn("Wallets category not found; product will have no category.");

  const first = images[0]!;
  const name = "RFIDsafe® RFID blocking aluminum slider wallet";
  const slug = "pacsafe-rfidsafe-rfid-blocking-aluminum-slider-wallet";
  const priceCents = 3995; // $39.95
  const description = `<p>With a quick slide, get instant access to your cards with this ultra slim and tough aluminum wallet. Using RFID-blocking technology, this wallet will help protect your identity and credit cards from unwanted scans. Designed to fit in your pocket and can hold up to 5 cards.</p>
<p><strong>Key features:</strong> RFID blocking material protects your credit cards against unwanted scans; slim profile; long-term durability; 5 normal card slots. RFIDsafe™ blocking pockets and material.</p>
<p><strong>Specifications:</strong> Height 3.7 in · Width 2.5 in · Depth 0.4 in · Weight 0.1 lbs. Main materials: aluminium alloy. 2-year warranty on accessories.</p>`;
  const features = [
    "RFID blocking material protects your credit cards against unwanted scans",
    "Slim profile — fits in your pocket",
    "Long-term durability — aluminium alloy",
    "5 normal card slots",
    "RFIDsafe™ blocking pockets and material",
  ];
  const pageTitle =
    "RFIDsafe® RFID Blocking Aluminum Slider Wallet | Pacsafe | Culture";
  const metaDescription =
    "Pacsafe RFIDsafe RFID blocking aluminum slider wallet — ultra slim, 5 card slots, protects from skimming. Dark Grey. Pay with crypto or card. Culture.";

  const body: Record<string, unknown> = {
    name,
    slug,
    priceCents,
    description,
    brand: "Pacsafe",
    vendor: "Pacsafe",
    published: true,
    physicalProduct: true,
    trackQuantity: false,
    features,
    imageUrl: first.url,
    mainImageAlt: first.alt,
    mainImageTitle: pageTitle,
    pageTitle,
    metaDescription,
    seoOptimized: true,
    hasVariants: true,
    optionDefinitionsJson: JSON.stringify([
      { name: "Color", values: ["Dark Grey"] },
    ]),
    variants: [{ size: null, color: "Dark Grey", priceCents, sku: "88005703" }],
    images: images.map((img, i) => ({
      url: img.url,
      alt: img.alt,
      title: img.title,
      sortOrder: i,
    })),
  };
  if (categoryId) body.categoryId = categoryId;

  const res = await fetch(`${API_BASE}/api/admin/products`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create product failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { id: string; name: string };
  console.log("Created product:", json.name, json.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
