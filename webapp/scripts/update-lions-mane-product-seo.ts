/**
 * Update features and image SEO for the Lions Mane Mushroom Blend Supplement (60 Capsules)
 * product at forthecult.store.
 *
 * Sets:
 * - features_json (bullet points from product page)
 * - mainImageAlt / mainImageTitle (main product image SEO)
 * - product_image alt/title for each gallery image
 *
 * Run from webapp:
 *   bun run scripts/update-lions-mane-product-seo.ts
 *
 * Requires: ADMIN_AI_API_KEY or ADMIN_API_KEY; API_BASE or MAIN_APP_URL or NEXT_PUBLIC_APP_URL.
 */

import "dotenv/config";

const API_BASE = (
  process.env.API_BASE ||
  process.env.MAIN_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const API_KEY =
  process.env.ADMIN_AI_API_KEY?.trim() || process.env.ADMIN_API_KEY?.trim();

const LIONS_MANE_SLUG = "lions-mane-mushroom-blend-supplement-60-capsules";

const FEATURES = [
  "Capsuled in the USA with globally sourced ingredients",
  "Capsuled at FDA Registered and GMP Certified Facilities",
  "3rd Party Laboratory Tested",
  "Non-GMO",
  "Vegan Friendly",
  "Vegetarian",
  "Corn Free",
  "Lactose Free",
  "Proprietary blend with Cordyceps, Shiitake, Lion's Mane, Reishi, Maitake, Turkey Tail, Chaga, and more",
  "Supports brain health and cognitive function",
  "Promotes energy levels and exercise performance",
  "60 vegetable capsules per bottle",
  "Please note: This product is shipped only to the United States and their territories",
];

const MAIN_IMAGE_ALT =
  "Lions Mane Mushroom Blend Supplement 60 Capsules bottle — Cordyceps, Shiitake, Lion's Mane, Reishi mushroom blend for brain health and energy";
const MAIN_IMAGE_TITLE =
  "Lions Mane Mushroom Blend Supplement (60 Capsules) | For the Culture";

/** Fallback alt/title for additional gallery images when no per-image copy is defined. */
const DEFAULT_IMAGE_ALT =
  "Lions Mane Mushroom Blend Supplement — 60 capsules, mushroom blend with Cordyceps, Shiitake, Lion's Mane";
const DEFAULT_IMAGE_TITLE =
  "Lions Mane Mushroom Blend Supplement (60 Capsules) | For the Culture";

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

async function main() {
  if (!API_KEY) {
    console.error(
      "Set ADMIN_AI_API_KEY or ADMIN_API_KEY. Optionally set API_BASE / MAIN_APP_URL / NEXT_PUBLIC_APP_URL.",
    );
    process.exit(1);
  }

  console.log("API base:", API_BASE);

  const listRes = await fetch(
    `${API_BASE}/api/admin/products?limit=100&search=lions`,
    { headers },
  );
  if (!listRes.ok) {
    console.error(
      "Failed to list products:",
      listRes.status,
      await listRes.text(),
    );
    process.exit(1);
  }
  const listData = (await listRes.json()) as {
    items?: Array<{ id: string; name: string; slug?: string | null }>;
    products?: Array<{ id: string; name: string; slug?: string | null }>;
  };
  const items = listData.items ?? listData.products ?? [];
  const product = items.find(
    (p) =>
      (p.slug ?? "").toLowerCase() === LIONS_MANE_SLUG ||
      p.name.toLowerCase().includes("lions mane") ||
      p.name.toLowerCase().includes("lion's mane"),
  );

  if (!product) {
    console.error(
      `Product with slug "${LIONS_MANE_SLUG}" (or name containing "lions mane") not found. List returned ${items.length} item(s).`,
    );
    if (items.length > 0) {
      console.error(
        "Slugs from response:",
        items.map((p) => p.slug ?? "(none)"),
      );
    }
    process.exit(1);
  }

  const productId = product.id;
  console.log(`Found product: ${product.name} (id: ${productId})`);

  const getRes = await fetch(`${API_BASE}/api/admin/products/${productId}`, {
    headers,
  });
  if (!getRes.ok) {
    console.error(
      "Failed to fetch product:",
      getRes.status,
      await getRes.text(),
    );
    process.exit(1);
  }
  const fullProduct = (await getRes.json()) as {
    images?: Array<{
      id?: string;
      url: string;
      alt?: string | null;
      title?: string | null;
      sortOrder?: number;
    }>;
  };
  const currentImages = fullProduct.images ?? [];

  const images = currentImages.map((img, i) => ({
    id: img.id,
    url: img.url,
    alt: i === 0 ? MAIN_IMAGE_ALT : DEFAULT_IMAGE_ALT,
    title: i === 0 ? MAIN_IMAGE_TITLE : DEFAULT_IMAGE_TITLE,
    sortOrder: typeof img.sortOrder === "number" ? img.sortOrder : i,
  }));

  const patchRes = await fetch(`${API_BASE}/api/admin/products/${productId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      slug: LIONS_MANE_SLUG,
      features: FEATURES,
      mainImageAlt: MAIN_IMAGE_ALT,
      mainImageTitle: MAIN_IMAGE_TITLE,
      seoOptimized: true,
      images: images.length > 0 ? images : undefined,
    }),
  });

  if (!patchRes.ok) {
    console.error("PATCH failed:", patchRes.status, await patchRes.text());
    process.exit(1);
  }

  console.log(
    "✓ Updated: features, mainImageAlt, mainImageTitle" +
      (images.length > 0 ? ", and product_image alt/title for gallery" : "") +
      ". Marked seoOptimized.",
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
