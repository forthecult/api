/**
 * PATCH product imageUrl and images (and optional variant imageUrls) from a JSON file.
 * Use this when files are already on UploadThing but the backend was never updated
 * (e.g. uploads succeeded but Save wasn't clicked in admin, or script PATCH failed).
 *
 * JSON file shape (see scripts/product-images-example.json):
 *   {
 *     "product-slug": {
 *       "imageUrl": "https://utfs.io/...",
 *       "mainImageAlt": "...",
 *       "mainImageTitle": "...",
 *       "images": [ { "url": "https://utfs.io/...", "alt": "...", "title": "..." } ],
 *       "variantImageUrls": { "Black": "https://utfs.io/...", "Blue": "..." }
 *     }
 *   }
 *
 * Usage:
 *   MAIN_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> \
 *   PRODUCT_IMAGES_JSON=./minirig-urls.json bun run scripts/patch-product-images-from-json.ts
 */

const MAIN_APP_URL =
  process.env.MAIN_APP_URL?.trim() || "https://forthecult.store";
const API_KEY =
  process.env.ADMIN_AI_API_KEY?.trim() || process.env.ADMIN_API_KEY?.trim();
const JSON_PATH = process.env.PRODUCT_IMAGES_JSON?.trim();

if (!API_KEY) {
  console.error("Set ADMIN_AI_API_KEY or ADMIN_API_KEY.");
  process.exit(1);
}
if (!JSON_PATH) {
  console.error(
    "Set PRODUCT_IMAGES_JSON to the path of your JSON file (e.g. ./minirig-urls.json).",
  );
  process.exit(1);
}

const API_BASE = MAIN_APP_URL.replace(/\/$/, "");
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

type ImageEntry = { url: string; alt?: string; title?: string };
type ProductImages = {
  imageUrl: string;
  mainImageAlt?: string;
  mainImageTitle?: string;
  images: ImageEntry[];
  variantImageUrls?: Record<string, string>;
};
type Payload = Record<string, ProductImages>;

async function main() {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const resolved = path.resolve(process.cwd(), JSON_PATH);
  if (!fs.existsSync(resolved)) {
    console.error("File not found:", resolved);
    process.exit(1);
  }
  const raw = fs.readFileSync(resolved, "utf8");
  let payload: Payload;
  try {
    payload = JSON.parse(raw) as Payload;
  } catch (e) {
    console.error("Invalid JSON:", e);
    process.exit(1);
  }

  const listRes = await fetch(`${API_BASE}/api/admin/products?limit=200`, {
    headers,
  });
  if (!listRes.ok) throw new Error(`Products: ${listRes.status}`);
  const listData = (await listRes.json()) as {
    items?: Array<{ id: string; slug?: string; name: string }>;
  };
  const products = listData.items ?? [];
  const bySlug = new Map(products.map((p) => [(p.slug ?? "").trim(), p]));

  let updated = 0;
  for (const [slug, spec] of Object.entries(payload)) {
    const product = bySlug.get(slug);
    if (!product) {
      console.warn("Product not found for slug:", slug);
      continue;
    }
    const getRes = await fetch(`${API_BASE}/api/admin/products/${product.id}`, {
      headers,
    });
    if (!getRes.ok) {
      console.error("GET", product.name, getRes.status);
      continue;
    }
    const current = (await getRes.json()) as {
      variants?: Array<{
        id: string;
        color?: string | null;
        size?: string | null;
        sku?: string | null;
        label?: string | null;
        stockQuantity?: number | null;
        priceCents?: number;
        imageUrl?: string | null;
        imageAlt?: string | null;
        imageTitle?: string | null;
      }>;
    };
    const variants = current.variants ?? [];

    const variantBodies =
      spec.variantImageUrls && variants.length > 0
        ? variants.map((v) => {
            const color = (v.color ?? "").trim();
            const newUrl = color ? spec.variantImageUrls![color] : undefined;
            return {
              id: v.id,
              size: v.size ?? null,
              color: v.color ?? null,
              sku: v.sku ?? null,
              label: v.label ?? null,
              stockQuantity: v.stockQuantity ?? null,
              priceCents: v.priceCents,
              imageUrl: (newUrl ?? v.imageUrl)?.trim() ?? null,
              imageAlt: v.imageAlt ?? null,
              imageTitle: v.imageTitle ?? null,
            };
          })
        : undefined;

    const body = {
      imageUrl: spec.imageUrl,
      mainImageAlt: spec.mainImageAlt ?? null,
      mainImageTitle: spec.mainImageTitle ?? null,
      images: spec.images.map((img, i) => ({
        url: img.url,
        alt: img.alt ?? null,
        title: img.title ?? null,
        sortOrder: i,
      })),
      ...(variantBodies && { variants: variantBodies }),
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
      console.error(
        "PATCH",
        product.name,
        patchRes.status,
        await patchRes.text(),
      );
      continue;
    }
    updated += 1;
    console.log("Updated", product.name);
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log("Done. Updated", updated, "product(s).");
  if (updated === 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
