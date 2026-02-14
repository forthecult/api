/**
 * Update content and SEO for Printful products from the store screenshot (Feb 2026):
 * - Lambo Kids Fleece Hoodie
 * - Kabosu Women's Organic Raglan Sweatshirt
 * - Coingecko Sweatshirt
 * - CoinGecko Men's Premium Polo
 * - Cat One-Piece Swimsuit
 * - Kabosu Youth Short Sleeve T-Shirt
 *
 * Sets: features, description, title (name), slug, meta description, meta title (pageTitle),
 * main image alt/title, product image alt/title; marks seoOptimized; then syncs store -> Printful.
 *
 * Uses the admin API only (no DATABASE_URL required).
 *
 * Run from relivator:
 *   bun run scripts/update-printful-products-seo.ts
 *
 * Requires: ADMIN_AI_API_KEY or ADMIN_API_KEY; API_BASE or MAIN_APP_URL or NEXT_PUBLIC_APP_URL.
 * Printful export requires the app to have PRINTFUL_API_TOKEN set (server-side).
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

const PRODUCT_NAMES = [
  "Lambo Kids Fleece Hoodie",
  "Kabosu Women's Organic Raglan Sweatshirt",
  "Coingecko Sweatshirt",
  "CoinGecko Men's Premium Polo",
  "Cat One-Piece Swimsuit",
  "Kabosu Youth Short Sleeve T-Shirt",
] as const;

type ProductKey = (typeof PRODUCT_NAMES)[number];

interface ProductSeo {
  title: string;
  slug: string;
  description: string;
  features: string[];
  pageTitle: string;
  metaDescription: string;
  mainImageAlt: string;
  mainImageTitle: string;
  /** Per-image alt/title; if product has more images we repeat or use index. */
  imageAlts: string[];
  imageTitles: string[];
}

const SEO_BY_PRODUCT: Record<string, ProductSeo> = {
  "Lambo Kids Fleece Hoodie": {
    title: "Lambo Kids Fleece Hoodie",
    slug: "lambo-kids-fleece-hoodie",
    description: `Premium kids' fleece hoodie from Culture. Soft, cozy fleece with a relaxed fit perfect for everyday wear. Features a clean, bold design that speaks to car and performance culture—part of our curated lifestyle gear for families who value quality and style.

Culture curates apparel that meets our standards: durable construction, comfortable fabrics, and designs that resonate with intentional living. This hoodie is made to last and easy to care for. Order with crypto or card; we ship worldwide.`,
    features: [
      "Soft fleece interior, comfortable for all-day wear",
      "Relaxed fit, easy to layer",
      "Durable construction, made to last",
      "Bold design for kids who love cars and performance",
      "Premium quality, Culture-curated",
    ],
    pageTitle: "Lambo Kids Fleece Hoodie | Culture",
    metaDescription:
      "Lambo Kids Fleece Hoodie. Soft fleece, bold design. Premium quality, Culture-curated. Pay with crypto or card. Worldwide shipping.",
    mainImageAlt: "Lambo Kids Fleece Hoodie, black hoodie with graphic, front view",
    mainImageTitle: "Lambo Kids Fleece Hoodie – Culture",
    imageAlts: [
      "Lambo Kids Fleece Hoodie front view, black fleece with design",
      "Lambo Kids Fleece Hoodie detail",
    ],
    imageTitles: [
      "Lambo Kids Fleece Hoodie – Culture",
      "Lambo Kids Fleece Hoodie detail",
    ],
  },

  "Kabosu Women's Organic Raglan Sweatshirt": {
    title: "Kabosu Women's Organic Raglan Sweatshirt",
    slug: "kabosu-womens-organic-raglan-sweatshirt",
    description: `Women's organic raglan sweatshirt featuring the iconic Kabosu (Doge) design. Made from soft organic cotton with a relaxed raglan fit and classic crewneck. The beloved Shiba Inu meme that defined internet culture is front and center—perfect for Dogecoin fans and anyone who gets the joke.

Culture has been part of the crypto and meme culture since 2015. We accept Dogecoin and 50+ cryptocurrencies alongside card. Premium apparel, toxin-free materials where possible, and designs that celebrate the communities we serve.`,
    features: [
      "Organic cotton, soft and breathable",
      "Raglan sleeves, relaxed fit",
      "Iconic Kabosu (Doge) design on front",
      "Premium quality, Culture-curated",
      "Pay with DOGE, crypto, or card",
    ],
    pageTitle: "Kabosu Women's Organic Raglan Sweatshirt | Culture",
    metaDescription:
      "Kabosu Women's Organic Raglan Sweatshirt. Organic cotton, Doge design. Pay with DOGE or card. Culture – premium crypto and meme apparel since 2015.",
    mainImageAlt: "Kabosu Women's Organic Raglan Sweatshirt, black raglan with Doge graphic",
    mainImageTitle: "Kabosu Women's Organic Raglan Sweatshirt – Culture",
    imageAlts: [
      "Kabosu Women's Organic Raglan Sweatshirt front, Doge meme design",
      "Kabosu Women's Organic Raglan Sweatshirt detail",
    ],
    imageTitles: [
      "Kabosu Women's Organic Raglan Sweatshirt – Culture",
      "Kabosu Women's Organic Raglan Sweatshirt detail",
    ],
  },

  "Coingecko Sweatshirt": {
    title: "CoinGecko Sweatshirt",
    slug: "coingecko-sweatshirt",
    description: `Official CoinGecko-branded sweatshirt. Comfortable crewneck with the iconic CoinGecko green lizard branding—recognized by millions of crypto users worldwide. Premium fabric, relaxed fit, perfect for casual wear or representing your favorite price-tracking platform.

Culture partners with brands that align with our values: transparency, quality, and community. CoinGecko is a trusted name in crypto data. We're proud to offer this merchandise; pay with crypto or card and ship globally.`,
    features: [
      "Official CoinGecko branding",
      "Soft, comfortable crewneck construction",
      "Iconic green lizard design",
      "Premium quality, Culture-curated",
      "Pay with crypto or card",
    ],
    pageTitle: "CoinGecko Sweatshirt | Culture",
    metaDescription:
      "CoinGecko Sweatshirt. Official CoinGecko branding, premium quality. Pay with crypto or card. Culture – curated crypto merchandise.",
    mainImageAlt: "CoinGecko Sweatshirt, black crewneck with green CoinGecko design",
    mainImageTitle: "CoinGecko Sweatshirt – Culture",
    imageAlts: [
      "CoinGecko Sweatshirt front view, black with green icons",
      "CoinGecko Sweatshirt detail",
    ],
    imageTitles: [
      "CoinGecko Sweatshirt – Culture",
      "CoinGecko Sweatshirt detail",
    ],
  },

  "CoinGecko Men's Premium Polo": {
    title: "CoinGecko Men's Premium Polo",
    slug: "coingecko-mens-premium-polo",
    description: `Men's premium polo shirt with official CoinGecko branding. Navy blue polo with the signature CoinGecko gecko logo on the chest—subtle, professional, and instantly recognizable. Ideal for meetups, conferences, or everyday wear for anyone who lives and breathes crypto data.

Culture curates partner merchandise that meets our quality bar. This polo is built to last and looks sharp. We accept 50+ cryptocurrencies and card; worldwide shipping.`,
    features: [
      "Premium polo construction",
      "Official CoinGecko logo on chest",
      "Navy blue, versatile and professional",
      "Premium quality, Culture-curated",
      "Pay with crypto or card",
    ],
    pageTitle: "CoinGecko Men's Premium Polo | Culture",
    metaDescription:
      "CoinGecko Men's Premium Polo. Navy blue, official logo. Premium quality. Pay with crypto or card. Culture – curated crypto merchandise.",
    mainImageAlt: "CoinGecko Men's Premium Polo, navy blue with gecko logo",
    mainImageTitle: "CoinGecko Men's Premium Polo – Culture",
    imageAlts: [
      "CoinGecko Men's Premium Polo front, navy with gecko logo",
      "CoinGecko Men's Premium Polo detail",
    ],
    imageTitles: [
      "CoinGecko Men's Premium Polo – Culture",
      "CoinGecko Men's Premium Polo detail",
    ],
  },

  "Cat One-Piece Swimsuit": {
    title: "Cat One-Piece Swimsuit",
    slug: "cat-one-piece-swimsuit",
    description: `One-piece swimsuit featuring a bold, lifelike cat face graphic across the front. Stand out at the pool or beach with this eye-catching design. Comfortable, secure fit with a classic one-piece cut—perfect for cat lovers and anyone who likes to make a statement.

Culture offers limited-edition and novelty apparel alongside our core wellness and tech catalog. Premium print quality and durable fabric. Pay with crypto or card; we ship worldwide.`,
    features: [
      "Bold cat face graphic design",
      "Comfortable one-piece cut",
      "Durable, swim-ready fabric",
      "Premium print quality",
      "Pay with crypto or card",
    ],
    pageTitle: "Cat One-Piece Swimsuit | Culture",
    metaDescription:
      "Cat One-Piece Swimsuit. Bold cat face design, comfortable fit. Premium quality. Pay with crypto or card. Culture.",
    mainImageAlt: "Cat One-Piece Swimsuit, white one-piece with cat face graphic",
    mainImageTitle: "Cat One-Piece Swimsuit – Culture",
    imageAlts: [
      "Cat One-Piece Swimsuit front view, white with cat face design",
      "Cat One-Piece Swimsuit detail",
    ],
    imageTitles: [
      "Cat One-Piece Swimsuit – Culture",
      "Cat One-Piece Swimsuit detail",
    ],
  },

  "Kabosu Youth Short Sleeve T-Shirt": {
    title: "Kabosu Youth Short Sleeve T-Shirt",
    slug: "kabosu-youth-short-sleeve-tshirt",
    description: `Youth short-sleeve t-shirt featuring the iconic Kabosu (Doge) meme. Soft, comfortable tee in a relaxed fit—perfect for kids and teens who love Dogecoin and internet culture. The classic Shiba Inu graphic that started a movement, now in a size for the next generation.

Culture has served the crypto community since 2015. We accept Dogecoin and dozens of other cryptocurrencies. Premium apparel, family-friendly designs, and worldwide shipping.`,
    features: [
      "Soft, comfortable short-sleeve tee",
      "Iconic Kabosu (Doge) design",
      "Youth fit, relaxed and durable",
      "Premium quality, Culture-curated",
      "Pay with DOGE, crypto, or card",
    ],
    pageTitle: "Kabosu Youth Short Sleeve T-Shirt | Culture",
    metaDescription:
      "Kabosu Youth Short Sleeve T-Shirt. Doge design for kids. Premium quality. Pay with DOGE or card. Culture – crypto and meme apparel since 2015.",
    mainImageAlt: "Kabosu Youth Short Sleeve T-Shirt, green tee with Doge graphic",
    mainImageTitle: "Kabosu Youth Short Sleeve T-Shirt – Culture",
    imageAlts: [
      "Kabosu Youth Short Sleeve T-Shirt front, Doge meme design",
      "Kabosu Youth Short Sleeve T-Shirt detail",
    ],
    imageTitles: [
      "Kabosu Youth Short Sleeve T-Shirt – Culture",
      "Kabosu Youth Short Sleeve T-Shirt detail",
    ],
  },
};

/** Normalize product name for matching (trim, collapse spaces). */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Find SEO config for a product by name (exact or normalized match). */
function getSeoForProduct(name: string): ProductSeo | null {
  const normalized = normalizeName(name);
  for (const key of PRODUCT_NAMES) {
    if (normalizeName(key) === normalized) return SEO_BY_PRODUCT[key] ?? null;
    if (normalized.toLowerCase().includes(key.toLowerCase()))
      return SEO_BY_PRODUCT[key] ?? null;
  }
  if (SEO_BY_PRODUCT[name as ProductKey]) return SEO_BY_PRODUCT[name as ProductKey];
  return null;
}

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

async function main() {
  if (!API_KEY) {
    console.error("Set ADMIN_AI_API_KEY or ADMIN_API_KEY.");
    process.exit(1);
  }

  const listRes = await fetch(
    `${API_BASE}/api/admin/products?vendor=Printful&limit=100`,
    { headers },
  );
  if (!listRes.ok) {
    console.error("Failed to list products:", listRes.status, await listRes.text());
    process.exit(1);
  }
  const listData = (await listRes.json()) as {
    items?: Array<{ id: string; name: string }>;
    products?: Array<{ id: string; name: string }>;
  };
  const products = listData.items ?? listData.products ?? [];

  const toUpdate = products.filter((p) => getSeoForProduct(p.name));
  if (toUpdate.length === 0) {
    console.log(
      "No matching Printful products found. Expected names like:",
      PRODUCT_NAMES.join(", "),
    );
    console.log(
      "Current Printful product names from API:",
      products.map((r) => r.name),
    );
    process.exit(1);
  }

  console.log(
    `Updating ${toUpdate.length} product(s) with SEO and marking Optimized, then syncing to Printful...\n`,
  );

  for (const row of toUpdate) {
    const seo = getSeoForProduct(row.name);
    if (!seo) continue;

    console.log("Product:", row.name);

    const getRes = await fetch(`${API_BASE}/api/admin/products/${row.id}`, { headers });
    if (!getRes.ok) {
      console.warn("  Failed to fetch product:", getRes.status);
      continue;
    }
    const product = (await getRes.json()) as {
      images?: Array<{ id?: string; url: string; alt?: string | null; title?: string | null; sortOrder?: number }>;
    };
    const currentImages = product.images ?? [];

    const images = currentImages.map((img, i) => ({
      id: img.id,
      url: img.url,
      alt: seo.imageAlts[i] ?? seo.mainImageAlt,
      title: seo.imageTitles[i] ?? seo.mainImageTitle,
      sortOrder: typeof img.sortOrder === "number" ? img.sortOrder : i,
    }));

    const patchRes = await fetch(`${API_BASE}/api/admin/products/${row.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        name: seo.title,
        slug: seo.slug,
        description: seo.description,
        features: seo.features,
        pageTitle: seo.pageTitle,
        metaDescription: seo.metaDescription,
        mainImageAlt: seo.mainImageAlt,
        mainImageTitle: seo.mainImageTitle,
        seoOptimized: true,
        images,
      }),
    });
    if (!patchRes.ok) {
      console.warn("  PATCH failed:", patchRes.status, await patchRes.text());
      continue;
    }
    console.log("  Updated SEO, features, description, slug, meta, image alt/title. Marked Optimized.");

    const exportRes = await fetch(`${API_BASE}/api/admin/printful/sync`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "export_single", productId: row.id }),
    });
    if (exportRes.ok) {
      const exportData = (await exportRes.json()) as { success?: boolean; error?: string };
      if (exportData.success) {
        console.log("  Synced to Printful.");
      } else {
        console.warn("  Printful export failed:", exportData.error ?? "unknown");
      }
    } else {
      console.warn("  Printful sync request failed:", exportRes.status, await exportRes.text());
    }
    console.log("");
  }

  console.log("Done. All matching products updated and pushed to Printful.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
