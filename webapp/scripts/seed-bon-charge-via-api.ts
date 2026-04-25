/**
 * Add Bon Charge brand, EMF Protection category, and Bon Charge products via admin API.
 * Fetches product images from Bon Charge (Shopify JSON), uploads them to our UploadThing CDN,
 * and creates products with images + SEO (alt, title, mainImageAlt, mainImageTitle).
 *
 * Products added (with 10% markup):
 * - EMF Radiation Blocking Laptop Mat (Small, Large)
 * - EMF Radiation Free Air Tube Earphones (AUX, USB-C)
 * - EMF Radiation Blocking Phone Pouch
 *
 * Usage (production):
 *   cd ftc
 *   MAIN_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> bun run scripts/seed-bon-charge-via-api.ts
 *
 * Prerequisites:
 * - Production must have UPLOADTHING_TOKEN set so admin upload works.
 * - Run db:seed-shipping-by-brand after to add US/International shipping for Bon Charge.
 */

import "dotenv/config";

const MAIN_APP_URL =
  process.env.MAIN_APP_URL?.trim() || "https://forthecult.store";
const API_KEY =
  process.env.ADMIN_AI_API_KEY?.trim() || process.env.ADMIN_API_KEY?.trim();
if (!API_KEY) {
  console.error(
    "Set ADMIN_AI_API_KEY (production) or ADMIN_API_KEY. Optionally MAIN_APP_URL.",
  );
  process.exit(1);
}

const API_BASE = MAIN_APP_URL.replace(/\/$/, "");
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

const BRAND_NAME = "Bon Charge";
const BONCHARGE_JSON = "https://boncharge.com/products";

/** Shopify product JSON image entry */
type ShopifyImage = {
  src: string;
  alt: string | null;
  position: number;
  variant_ids: unknown[];
};

/** Fetch Bon Charge product JSON by Shopify handle. Returns images (exclude variant-only), max 5. */
async function fetchBonChargeImages(
  handle: string,
): Promise<Array<{ src: string; alt: string }>> {
  const res = await fetch(`${BONCHARGE_JSON}/${handle}.json`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { product?: { images?: ShopifyImage[] } };
  const images = data.product?.images ?? [];
  const productImages = images
    .filter((img) => !img.variant_ids?.length)
    .sort((a, b) => a.position - b.position)
    .slice(0, 5)
    .map((img) => ({ src: img.src, alt: img.alt?.trim() || "Product image" }));
  return productImages;
}

/** Fetch image from URL, return buffer and mime type. */
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

/** Upload image to our CDN (UploadThing) via admin API. Returns URL or null. */
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
    console.warn(
      "  Upload failed:",
      res.status,
      (await res.text()).slice(0, 150),
    );
    return null;
  }
  const data = (await res.json()) as { url?: string };
  return data.url ?? null;
}

/** For a product: fetch image list from Bon Charge, upload each to UploadThing, return our image entries with SEO. */
async function buildProductImages(
  handle: string,
  productName: string,
  pageTitle: string,
): Promise<Array<{ url: string; alt: string; title: string }>> {
  const sources = await fetchBonChargeImages(handle);
  if (sources.length === 0) {
    console.warn("  No images from Bon Charge JSON for", productName);
    return [];
  }
  const result: Array<{ url: string; alt: string; title: string }> = [];
  for (let i = 0; i < sources.length; i++) {
    const { src, alt } = sources[i]!;
    const data = await fetchImageBuffer(src);
    if (!data) continue;
    const slug = handle.replace(/^emf-/, "").slice(0, 20);
    const cdnUrl = await uploadToUploadThing(
      data.buffer,
      data.mimeType,
      `bon-charge-${slug}-${i + 1}`,
    );
    if (cdnUrl) {
      const title = i === 0 ? pageTitle : `${productName} — ${alt}`;
      result.push({ url: cdnUrl, alt, title });
      console.log("  Uploaded image", i + 1, "→ UploadThing");
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return result;
}

async function getOrCreateBrand(): Promise<string | null> {
  const listRes = await fetch(
    `${API_BASE}/api/admin/brands?search=Bon%20Charge&limit=5`,
    { headers },
  );
  if (!listRes.ok) throw new Error(`Brands list: ${listRes.status}`);
  const listData = (await listRes.json()) as {
    items?: Array<{ id: string; name: string }>;
  };
  const existing = listData.items?.[0];
  if (existing) {
    console.log("Using existing brand:", existing.name, existing.id);
    return existing.id;
  }
  const createRes = await fetch(`${API_BASE}/api/admin/brands`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: BRAND_NAME,
      slug: "bon-charge",
      websiteUrl: "https://boncharge.com/",
      description:
        "Science-backed wellness and recovery products: red light therapy, infrared sauna blankets, PEMF devices, blue light blocking, and EMF protection. Official Red Light & Recovery Partner of Fulham FC. HSA/FSA-eligible. Free shipping on orders over $125.",
      featured: true,
    }),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    if (
      createRes.status === 409 ||
      text.includes("unique") ||
      text.includes("slug")
    ) {
      const list2 = await fetch(
        `${API_BASE}/api/admin/brands?search=Bon%20Charge&limit=5`,
        { headers },
      );
      const data2 = (await list2.json()) as { items?: Array<{ id: string }> };
      return data2.items?.[0]?.id ?? null;
    }
    throw new Error(`Brand create failed: ${createRes.status} ${text}`);
  }
  const json = (await createRes.json()) as { id: string; name: string };
  console.log("Created brand:", json.name, json.id);
  return json.id;
}

async function getOrCreateCategoryEmfProtection(): Promise<string | null> {
  const listRes = await fetch(`${API_BASE}/api/admin/categories?limit=300`, {
    headers,
  });
  if (!listRes.ok) throw new Error(`Categories: ${listRes.status}`);
  const data = (await listRes.json()) as {
    items?: Array<{ id: string; slug?: string; name: string }>;
  };
  const items = data.items ?? [];
  const bySlug = new Map(items.map((c) => [c.slug ?? "", c]));
  const emf =
    bySlug.get("emf-protection") ??
    items.find((c) => /emf|protection/i.test(c.name));
  if (emf) {
    console.log("Using existing category:", emf.name, emf.id);
    return emf.id;
  }
  const createRes = await fetch(`${API_BASE}/api/admin/categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "EMF Protection",
      slug: "emf-protection",
      title: "EMF Protection — Radiation Blocking & EMF-Free Tech | Culture",
      metaDescription:
        "EMF blocking laptop mats, phone pouches, and air tube earphones. Reduce exposure to electromagnetic radiation from devices. Bon Charge and more. Pay with crypto or card. Culture.",
      description:
        "Reduce your exposure to electromagnetic radiation. We carry EMF blocking laptop mats, phone pouches, and air tube earphones so you can work and listen safely. Science-backed products from trusted brands.",
      featured: false,
      visible: true,
    }),
  });
  if (!createRes.ok)
    throw new Error(
      `Category create failed: ${createRes.status} ${await createRes.text()}`,
    );
  const json = (await createRes.json()) as { id: string; name: string };
  console.log("Created category:", json.name, json.id);
  return json.id;
}

// Base prices from boncharge.com; we add 10%.
const LAPTOP_MAT_BASE = 9999; // $99.99
const EARPHONES_BASE = 8999; // $89.99
const PHONE_POUCH_BASE = 4999; // $49.99
const markup = 1.1;

const LAPTOP_MAT_PRICE_SMALL = Math.round(LAPTOP_MAT_BASE * markup);
const LAPTOP_MAT_PRICE_LARGE = Math.round(LAPTOP_MAT_BASE * markup);
const EARPHONES_AUX = Math.round(EARPHONES_BASE * markup);
const EARPHONES_USBC = Math.round(EARPHONES_BASE * markup);
const PHONE_POUCH_PRICE = Math.round(PHONE_POUCH_BASE * markup);

/** Our slug → Bon Charge Shopify handle (for .json) */
const SLUG_TO_HANDLE: Record<string, string> = {
  "bon-charge-emf-radiation-blocking-laptop-mat":
    "emf-radiation-blocking-laptop-mat",
  "bon-charge-emf-radiation-free-air-tube-earphones":
    "emf-radiation-free-air-tube-headphones-earphones",
  "bon-charge-emf-radiation-blocking-phone-pouch":
    "emf-radiation-blocking-phone-pouch",
};

const products: Array<{
  name: string;
  slug: string;
  priceCents: number;
  description: string;
  features: string[];
  pageTitle: string;
  metaDescription: string;
  hasVariants: boolean;
  optionDefinitionsJson?: string;
  variants?: Array<{
    size?: string | null;
    color?: string | null;
    label?: string | null;
    priceCents: number;
    sku?: string;
  }>;
}> = [
  {
    name: "EMF Radiation Blocking Laptop Mat",
    slug: "bon-charge-emf-radiation-blocking-laptop-mat",
    priceCents: LAPTOP_MAT_PRICE_SMALL,
    description: `<p>Create a safer work environment by blocking EMF radiation up to 20GHz. Our EMF Radiation Blocking Laptop Mats reduce RF, heat, and ELF radiation with ultimate comfort and sleek ergonomic design. The mat blocks up to 99% of EMF radiation up to 20GHz—including WiFi, Bluetooth, and cellular (3G, 4G, 5G).</p>
<p>Place the mat under your laptop and let it create a protective barrier between your lap and EMF radiation. It also acts as a heat shield, dissipating excess heat from your laptop. Available in two sizes; lightweight and portable. Materials: vegan leather, Faraday fabric, anti-radiation foil. Waterproof.</p>
<p><strong>Specifications:</strong> Small — 20cm × 30cm (8 in × 11.8 in), max laptop 13 in. Large — 30.5cm × 40cm (12 in × 16 in), max laptop 19 in. Radiation blocked: 99% from 0.1Hz to 20GHz.</p>`,
    features: [
      "Blocks 99% of EMF radiation up to 20GHz (WiFi, Bluetooth, 3G/4G/5G)",
      "Heat shielding technology — dissipates laptop heat",
      "Ergonomic design — solid, flat surface",
      "Premium vegan leather — waterproof, easy to wipe down",
      "Two sizes — fits most laptops",
    ],
    pageTitle: "EMF Radiation Blocking Laptop Mat | Bon Charge | Culture",
    metaDescription:
      "Bon Charge EMF laptop mat blocks 99% of EMF up to 20GHz and shields heat. Small & large sizes. Vegan leather, Faraday fabric. Reduce radiation from your laptop. Pay with crypto or card. Culture.",
    hasVariants: true,
    optionDefinitionsJson: JSON.stringify([
      {
        name: "Size",
        values: [
          "Small - 20cm (8 in) x 30cm (11.8 in)",
          "Large - 30.5cm (12 in) x 40cm (16 in)",
        ],
      },
    ]),
    variants: [
      {
        size: "Small - 20cm (8 in) x 30cm (11.8 in)",
        priceCents: LAPTOP_MAT_PRICE_SMALL,
        sku: "BC-EMF-MAT-S",
      },
      {
        size: "Large - 30.5cm (12 in) x 40cm (16 in)",
        priceCents: LAPTOP_MAT_PRICE_LARGE,
        sku: "BC-EMF-MAT-L",
      },
    ],
  },
  {
    name: "EMF Radiation Free Air Tube Earphones",
    slug: "bon-charge-emf-radiation-free-air-tube-earphones",
    priceCents: EARPHONES_AUX,
    description: `<p>Listen without RF radiation. Our Air Tubes use air-filled acoustic chambers instead of traditional wires, acting as a barrier between the audio source and your ears. This design removes direct contact with potentially harmful EMF radiation for a safe listening experience.</p>
<p>Developed by audio engineers for sound quality and comfort. Includes three lightweight, ergonomic earbud sizes. Flexible, tangle-free cord. Universal compatibility—works with smartphones, tablets, laptops, and more. Blocks 100% of RF from the connected device by converting RF signals to acoustic signals.</p>
<p><strong>Specifications:</strong> Cable 142cm (56 in). Material: plastic, copper, nylon. Weight 123g. Output: AUX or USB-C. Ear bud sizes: small, medium, large. No microphone.</p>`,
    features: [
      "100% RF radiation free — air tube technology",
      "Quality stereo sound",
      "Three interchangeable ear tip sizes (small, medium, large)",
      "Durable, tangle-free cord",
      "Universal — AUX or USB-C output",
    ],
    pageTitle: "EMF Radiation Free Air Tube Earphones | Bon Charge | Culture",
    metaDescription:
      "Bon Charge Air Tube earphones block 100% RF radiation. Air-filled acoustic design, quality stereo, 3 ear tip sizes. AUX & USB-C. Safer listening. Pay with crypto or card. Culture.",
    hasVariants: true,
    optionDefinitionsJson: JSON.stringify([
      { name: "Output", values: ["AUX", "USB-C"] },
    ]),
    variants: [
      {
        size: null,
        label: "AUX",
        priceCents: EARPHONES_AUX,
        sku: "BC-AIR-TUBE-AUX",
      },
      {
        size: null,
        label: "USB-C",
        priceCents: EARPHONES_USBC,
        sku: "BC-AIR-TUBE-USBC",
      },
    ],
  },
  {
    name: "EMF Radiation Blocking Phone Pouch",
    slug: "bon-charge-emf-radiation-blocking-phone-pouch",
    priceCents: PHONE_POUCH_PRICE,
    description: `<p>Protect your phone from EMF radiation, enhance cybersecurity, safeguard privacy, and shield against EMP attacks. Our EMF Radiation Blocking Phone Pouch blocks up to 99% of EMF radiation to 30GHz. Made with 100% silver-coated anti-EMF fabric inside.</p>
<p>It blocks signal transmission, helping prevent remote hacking and protecting sensitive data. The pouch also provides defence against electromagnetic pulse (EMP) events. Dimensions: 6.7 in × 3.9 in (17cm × 10cm). Blocks cellular, WiFi, Bluetooth, 5G, RF, RFID, NFC, EKYS.</p>`,
    features: [
      "Blocks 99% of EMF radiation up to 30GHz",
      "Cybersecurity & privacy — blocks signals to reduce remote hacking",
      "EMP attack shield — protects device from EMP damage",
      "100% silver-coated EMF shielding fabric",
      "Compact — fits most smartphones (6.7 × 3.9 in)",
    ],
    pageTitle: "EMF Radiation Blocking Phone Pouch | Bon Charge | Culture",
    metaDescription:
      "Bon Charge EMF phone pouch blocks 99% EMF to 30GHz, enhances cybersecurity and EMP protection. Silver-coated fabric. Pay with crypto or card. Culture.",
    hasVariants: false,
  },
];

async function createOrUpdateProduct(
  payload: (typeof products)[0],
  categoryId: string | null,
  images: Array<{ url: string; alt: string; title: string }>,
  existingId: string | null,
): Promise<string> {
  const first = images[0];
  const body: Record<string, unknown> = {
    name: payload.name,
    slug: payload.slug,
    priceCents: payload.priceCents,
    description: payload.description,
    brand: BRAND_NAME,
    vendor: "Bon Charge",
    published: true,
    physicalProduct: true,
    trackQuantity: false,
    features: payload.features,
    imageUrl: first?.url ?? null,
    mainImageAlt: first?.alt ?? null,
    mainImageTitle: first?.title ?? payload.pageTitle,
    pageTitle: payload.pageTitle,
    metaDescription: payload.metaDescription,
    seoOptimized: true,
    hasVariants: payload.hasVariants,
    optionDefinitionsJson: payload.optionDefinitionsJson ?? null,
    images: images.map((img, i) => ({
      url: img.url,
      alt: img.alt,
      title: img.title,
      sortOrder: i,
    })),
  };
  if (categoryId) body.categoryId = categoryId;
  if (payload.hasVariants && payload.variants?.length) {
    body.variants = payload.variants.map((v) => ({
      size: v.size ?? null,
      color: v.color ?? null,
      label: v.label ?? null,
      priceCents: v.priceCents,
      sku: v.sku ?? null,
    }));
  }

  if (existingId) {
    const res = await fetch(`${API_BASE}/api/admin/products/${existingId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        imageUrl: body.imageUrl,
        mainImageAlt: body.mainImageAlt,
        mainImageTitle: body.mainImageTitle,
        images: body.images,
      }),
    });
    if (!res.ok)
      throw new Error(
        `${payload.name} PATCH: ${res.status} ${await res.text()}`,
      );
    console.log("Updated product:", payload.name, existingId);
    return existingId;
  }

  const res = await fetch(`${API_BASE}/api/admin/products`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok)
    throw new Error(`${payload.name}: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { id: string; name: string };
  console.log("Created product:", json.name, json.id);
  return json.id;
}

async function main() {
  console.log("API base:", API_BASE);
  await getOrCreateBrand();
  const categoryId = await getOrCreateCategoryEmfProtection();

  const listRes = await fetch(
    `${API_BASE}/api/admin/products?search=Bon%20Charge&limit=20`,
    { headers },
  );
  const listData = (await listRes.json()) as {
    items?: Array<{ id: string; slug?: string }>;
  };
  const existingBySlug = new Map(
    (listData.items ?? []).map((i) => [i.slug ?? "", i.id]),
  );

  for (const p of products) {
    const existingId = existingBySlug.get(p.slug) ?? null;
    const handle = SLUG_TO_HANDLE[p.slug];
    if (!handle) {
      console.warn("No Bon Charge handle for", p.slug);
      await createOrUpdateProduct(p, categoryId, [], existingId);
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }
    console.log("Images for", p.name, "...");
    const images = await buildProductImages(handle, p.name, p.pageTitle);
    await createOrUpdateProduct(p, categoryId, images, existingId);
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(
    "Done. Bon Charge brand and 3 products added/updated with images on UploadThing and SEO. Run db:seed-shipping-by-brand to add US/International shipping.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
