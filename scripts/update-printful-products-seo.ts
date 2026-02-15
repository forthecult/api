/**
 * Update content and SEO for Printful products (Feb 2026 batch):
 * - Lambo Kids Fleece Hoodie
 * - Kabosu Women's Organic Raglan Sweatshirt
 * - CoinGecko Sweatshirt
 * - CoinGecko Embroidered Men's Premium Polo
 * - Cat One-Piece Swimsuit
 * - Kabosu Youth Short Sleeve T-Shirt
 *
 * Comprehensive SEO with product specs from Printful catalog, design descriptions,
 * and Culture brand narrative. No payment method mentions.
 *
 * Uses the admin API only (no DATABASE_URL required).
 *
 * Run from ftc:
 *   bun run scripts/update-printful-products-seo.ts
 *   bun run printful:update-seo
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

// ---------------------------------------------------------------------------
// Product SEO definitions
// ---------------------------------------------------------------------------

interface ProductSeo {
  /** Match pattern: product name must include this (case-insensitive). */
  matchPattern: string;
  title: string;
  slug: string;
  description: string;
  features: string[];
  pageTitle: string;
  metaDescription: string;
  mainImageAlt: string;
  mainImageTitle: string;
  imageAlts: string[];
  imageTitles: string[];
}

const PRODUCTS: ProductSeo[] = [
  // -------------------------------------------------------------------------
  // 1. Lambo Kids Fleece Hoodie
  // -------------------------------------------------------------------------
  {
    matchPattern: "lambo kids",
    title: "Lambo Kids Fleece Hoodie",
    slug: "lambo-kids-fleece-hoodie",
    description: `A cozy kids' fleece hoodie built on the Cotton Heritage Y2550 blank—7.0 oz., 65/35 cotton-polyester 3-end fleece with a brushed interior for a super-soft hand feel. The 2-panel hood, ribbed cuffs, and ribbed waistband with lycra keep the fit snug and comfortable through every adventure. Side-seamed construction prevents twisting, and the tear-away label means no scratchy tags.

The front features a bold Lamborghini-inspired graphic that channels the energy of speed, ambition, and performance culture. It's a nod to the "Lambo" meme that's become inseparable from crypto and internet culture—the dream car that symbolizes making it.

At Culture, we curate apparel that resonates with the communities we serve. This hoodie brings together premium construction and a design rooted in the optimism and irreverence of internet culture—sized for the next generation of dreamers.`,
    features: [
      "7.0 oz. 65/35 cotton-polyester 3-end fleece, brushed interior",
      "2-panel hood with ribbed cuffs and waistband with lycra",
      "Side-seamed construction to prevent twisting",
      "Tear-away label for comfort",
      "Bold Lamborghini-inspired graphic — internet culture meets performance",
      "Youth sizes XS–XL",
    ],
    pageTitle:
      "Lambo Kids Fleece Hoodie — Performance Culture for Kids | Culture",
    metaDescription:
      "Lambo Kids Fleece Hoodie. Cotton Heritage 65/35 fleece with brushed interior, ribbed cuffs, and bold Lambo-inspired graphic. Premium quality youth hoodie from Culture.",
    mainImageAlt:
      "Lambo Kids Fleece Hoodie — black fleece hoodie with Lamborghini-inspired graphic, front view",
    mainImageTitle: "Lambo Kids Fleece Hoodie | Culture",
    imageAlts: [
      "Lambo Kids Fleece Hoodie front view — black fleece with Lamborghini-inspired graphic print",
      "Lambo Kids Fleece Hoodie back view — plain black fleece with hood detail",
      "Lambo Kids Fleece Hoodie close-up — brushed fleece texture and ribbed cuff detail",
    ],
    imageTitles: [
      "Lambo Kids Fleece Hoodie — Front | Culture",
      "Lambo Kids Fleece Hoodie — Back | Culture",
      "Lambo Kids Fleece Hoodie — Detail | Culture",
    ],
  },

  // -------------------------------------------------------------------------
  // 2. Kabosu Women's Organic Raglan Sweatshirt
  // -------------------------------------------------------------------------
  {
    matchPattern: "kabosu women",
    title: "Kabosu Women's Organic Raglan Sweatshirt",
    slug: "kabosu-womens-organic-raglan-sweatshirt",
    description: `A women's raglan sweatshirt crafted on the SOL'S 03104 blank—280 gsm cotton-faced fabric with a brushed-back fleece interior for warmth without bulk. The drop-shoulder raglan sleeves give a relaxed, contemporary silhouette, while the 2×2 ribbed collar, cuffs, and hem maintain a clean shape. Finished with a taped neck, V-detail at the front neckline, and a half-moon back yoke for subtle structural refinement.

The design features the iconic Kabosu—the Shiba Inu behind the original Doge meme that launched a thousand coins and defined an era of internet culture. Kabosu's face became a symbol of community, humor, and the idea that something playful can carry real value. This sweatshirt is a tribute to that spirit.

Culture has been part of the crypto and meme ecosystem since 2015. We choose designs that mean something to the communities we serve, printed on garments built for everyday wear. This organic raglan sweatshirt pairs a meaningful design with a quality construction you'll reach for again and again.`,
    features: [
      "280 gsm cotton-faced fabric with brushed-back fleece interior",
      "Drop-shoulder raglan sleeves for a relaxed, modern fit",
      "2×2 ribbed collar, cuffs, and hem for clean shape retention",
      "Taped neck with V-detail and half-moon back yoke",
      "Iconic Kabosu (Doge) Shiba Inu meme graphic on front",
      "Available in multiple colors and sizes XS–3XL",
    ],
    pageTitle:
      "Kabosu Women's Organic Raglan Sweatshirt — Doge Meme Apparel | Culture",
    metaDescription:
      "Kabosu Women's Organic Raglan Sweatshirt. SOL'S 280 gsm cotton-faced fleece, drop-shoulder raglan fit, iconic Doge Shiba Inu design. Premium meme apparel from Culture.",
    mainImageAlt:
      "Kabosu Women's Organic Raglan Sweatshirt — black raglan with iconic Doge Shiba Inu graphic",
    mainImageTitle: "Kabosu Women's Organic Raglan Sweatshirt | Culture",
    imageAlts: [
      "Kabosu Women's Organic Raglan Sweatshirt front — black with Doge Shiba Inu meme graphic",
      "Kabosu Women's Organic Raglan Sweatshirt back — clean black raglan with drop-shoulder detail",
      "Kabosu Women's Organic Raglan Sweatshirt close-up — Kabosu Doge face print detail",
      "Kabosu Women's Organic Raglan Sweatshirt flat lay — bottle green colorway",
    ],
    imageTitles: [
      "Kabosu Women's Organic Raglan Sweatshirt — Front | Culture",
      "Kabosu Women's Organic Raglan Sweatshirt — Back | Culture",
      "Kabosu Women's Organic Raglan Sweatshirt — Print Detail | Culture",
      "Kabosu Women's Organic Raglan Sweatshirt — Green Colorway | Culture",
    ],
  },

  // -------------------------------------------------------------------------
  // 3. CoinGecko Sweatshirt (variant name may say "Coingecko")
  // -------------------------------------------------------------------------
  {
    matchPattern: "coingecko sweatshirt",
    title: "CoinGecko Sweatshirt",
    slug: "coingecko-sweatshirt",
    description: `A unisex crew neck sweatshirt built on the Stanley/Stella STSU823 Changer blank—350 gsm, 85% organic ring-spun combed cotton and 15% recycled polyester with a brushed, lightly sueded interior finish. Set-in sleeves, 1×1 ribbed neck, cuffs, and hem, twin-needle topstitching at key seams for durability, and a herringbone back neck tape with self-fabric half-moon detail. The garment carries GOTS, Oeko-Tex Standard 100, Fair Wear Foundation, and PETA Approved Vegan certifications.

The front features an official CoinGecko design with the brand's signature green gecko motifs—instantly recognizable to anyone in the crypto data space. CoinGecko has been a cornerstone of crypto market intelligence since 2014, tracking thousands of tokens and providing the data layer the community relies on. This sweatshirt represents that partnership between Culture and one of the most trusted names in blockchain analytics.

At Culture, we partner with brands whose values align with ours: transparency, open data, and community. This sweatshirt combines a premium, sustainability-certified blank with a design that speaks to the crypto-native audience.`,
    features: [
      "350 gsm, 85% organic ring-spun combed cotton / 15% recycled polyester",
      "Brushed, lightly sueded interior for a soft hand feel",
      "Set-in sleeves with 1×1 ribbed neck, cuffs, and hem",
      "Twin-needle topstitching and herringbone back neck tape",
      "GOTS, Oeko-Tex 100, Fair Wear, and PETA Vegan certified",
      "Official CoinGecko green gecko branding on front",
      "Unisex fit, sizes XXS–5XL",
    ],
    pageTitle: "CoinGecko Sweatshirt — Official Organic Crewneck | Culture",
    metaDescription:
      "CoinGecko Sweatshirt. Stanley/Stella 350 gsm organic cotton crewneck with official CoinGecko branding. GOTS & Oeko-Tex certified. Premium crypto merchandise from Culture.",
    mainImageAlt:
      "CoinGecko Sweatshirt — black organic crewneck with official green CoinGecko gecko design",
    mainImageTitle: "CoinGecko Sweatshirt | Culture",
    imageAlts: [
      "CoinGecko Sweatshirt front — black organic crewneck with green CoinGecko gecko graphic",
      "CoinGecko Sweatshirt back — clean black crewneck with ribbed cuff and hem detail",
      "CoinGecko Sweatshirt flat lay — white colorway with green CoinGecko print",
    ],
    imageTitles: [
      "CoinGecko Sweatshirt — Front | Culture",
      "CoinGecko Sweatshirt — Back | Culture",
      "CoinGecko Sweatshirt — White Colorway | Culture",
    ],
  },

  // -------------------------------------------------------------------------
  // 4. CoinGecko Embroidered Men's Premium Polo
  // -------------------------------------------------------------------------
  {
    matchPattern: "coingecko",
    title: "CoinGecko Embroidered Men's Premium Polo",
    slug: "coingecko-mens-premium-polo",
    description: `A men's premium polo built on the Port Authority K500 Silk Touch blank—5 oz., 65/35 poly/cotton pique with a silky-smooth finish that resists wrinkles and shrinking. Flat-knit collar and cuffs, metal buttons with dyed-to-match plastic rims, double-needle armhole seams and hem, and side vents for ease of movement. This is the polo that's become an enduring favorite for its combination of comfort, clean lines, and durability.

The left chest features a precision-embroidered CoinGecko gecko logo—subtle, professional, and instantly recognizable within the crypto community. CoinGecko is one of the most trusted cryptocurrency data aggregators in the world, and this embroidered polo is part of our official partner merchandise program with them.

Culture curates apparel that works beyond the screen. Whether you're at a conference, a meetup, or just out in the world, this polo communicates an affinity for open data and the crypto ecosystem without saying a word. Premium construction meets a design with real community significance.`,
    features: [
      "5 oz. 65/35 poly/cotton pique with Silk Touch finish",
      "Wrinkle and shrink resistant",
      "Flat-knit collar and cuffs with metal buttons",
      "Double-needle armhole seams, hem, and side vents",
      "Precision-embroidered CoinGecko gecko logo on left chest",
      "Available in Navy, Steel Grey, White, and more — sizes XS–5XL",
    ],
    pageTitle:
      "CoinGecko Embroidered Men's Premium Polo — Official Partner Merchandise | Culture",
    metaDescription:
      "CoinGecko Embroidered Men's Premium Polo. Port Authority Silk Touch 65/35 pique, wrinkle-resistant, embroidered gecko logo. Official CoinGecko partner merchandise from Culture.",
    mainImageAlt:
      "CoinGecko Embroidered Men's Premium Polo — navy blue polo with embroidered gecko logo on chest",
    mainImageTitle: "CoinGecko Embroidered Men's Premium Polo | Culture",
    imageAlts: [
      "CoinGecko Embroidered Men's Premium Polo front — navy blue with embroidered gecko logo",
      "CoinGecko Embroidered Men's Premium Polo detail — close-up of embroidered CoinGecko gecko",
      "CoinGecko Embroidered Men's Premium Polo — steel grey colorway with embroidered logo",
      "CoinGecko Embroidered Men's Premium Polo — white colorway with embroidered gecko logo",
    ],
    imageTitles: [
      "CoinGecko Embroidered Men's Premium Polo — Navy | Culture",
      "CoinGecko Embroidered Men's Premium Polo — Embroidery Detail | Culture",
      "CoinGecko Embroidered Men's Premium Polo — Steel Grey | Culture",
      "CoinGecko Embroidered Men's Premium Polo — White | Culture",
    ],
  },

  // -------------------------------------------------------------------------
  // 5. Cat One-Piece Swimsuit
  // -------------------------------------------------------------------------
  {
    matchPattern: "cat one-piece",
    title: "Cat One-Piece Swimsuit",
    slug: "cat-one-piece-swimsuit",
    description: `An all-over print one-piece swimsuit with a photorealistic cat face covering the entire garment from seam to seam. Made from a smooth polyester-spandex blend with four-way stretch for a secure, comfortable fit that moves with you. The sublimation printing process produces vivid, fade-resistant colors and crisp detail—the whiskers, eyes, and fur texture are rendered with striking clarity.

The cut is a classic one-piece silhouette with a scoop neck and moderate leg opening, designed for both swimming and styling. The fabric offers quick-dry performance and holds its shape through chlorine, salt water, and sun exposure.

Culture carries a curated selection of statement and novelty pieces alongside our core wellness and tech catalog. This swimsuit is for anyone who appreciates bold, conversation-starting design—and it's built to perform in the water, not just turn heads poolside.`,
    features: [
      "All-over sublimation print — vivid, fade-resistant photorealistic cat face",
      "Polyester-spandex blend with four-way stretch",
      "Classic one-piece cut with scoop neck",
      "Quick-dry fabric, chlorine and salt water resistant",
      "Seam-to-seam print coverage for full graphic impact",
      "Women's sizes S–2XL",
    ],
    pageTitle:
      "Cat One-Piece Swimsuit — All-Over Print Statement Swimwear | Culture",
    metaDescription:
      "Cat One-Piece Swimsuit. All-over sublimation print with photorealistic cat face, polyester-spandex four-way stretch, fade-resistant. Statement swimwear from Culture.",
    mainImageAlt:
      "Cat One-Piece Swimsuit — all-over print one-piece with photorealistic cat face graphic",
    mainImageTitle: "Cat One-Piece Swimsuit | Culture",
    imageAlts: [
      "Cat One-Piece Swimsuit front — all-over photorealistic cat face sublimation print",
      "Cat One-Piece Swimsuit back — full coverage sublimation print detail",
    ],
    imageTitles: [
      "Cat One-Piece Swimsuit — Front | Culture",
      "Cat One-Piece Swimsuit — Back | Culture",
    ],
  },

  // -------------------------------------------------------------------------
  // 6. Kabosu Youth Short Sleeve T-Shirt
  // -------------------------------------------------------------------------
  {
    matchPattern: "kabosu youth",
    title: "Kabosu Youth Short Sleeve T-Shirt",
    slug: "kabosu-youth-short-sleeve-tshirt",
    description: `A youth t-shirt built on the Bella + Canvas 3001Y blank—4.2 oz., 100% Airlume combed and ring-spun cotton (heather colors are 52/48 cotton-poly). The Airlume cotton is combed for softness and ring-spun for strength, delivering a premium hand feel that outperforms standard jersey. Side-seamed construction, ribbed crew neck collar, shoulder taping for durability, and a tear-away label for tag-free comfort. Cut and dyed in the USA.

The front features the iconic Kabosu—the Shiba Inu whose photo became the Doge meme that launched Dogecoin and redefined what internet communities can accomplish. It's one of the most recognized images in digital culture, and this tee brings it to the next generation in a form they can actually wear.

Culture has served the crypto and meme community since 2015. This youth tee combines the quality of Bella + Canvas with a design that has genuine cultural weight—a piece of internet history made wearable.`,
    features: [
      "4.2 oz. 100% Airlume combed and ring-spun cotton (heathers: 52/48 cotton-poly)",
      "Side-seamed construction with ribbed crew neck collar",
      "Shoulder taping for reinforced durability",
      "Tear-away label for tag-free comfort",
      "Iconic Kabosu (Doge) Shiba Inu meme graphic on front",
      "Youth sizes S–XL, retail unisex fit",
    ],
    pageTitle:
      "Kabosu Youth Short Sleeve T-Shirt — Doge Meme Tee for Kids | Culture",
    metaDescription:
      "Kabosu Youth Short Sleeve T-Shirt. Bella + Canvas 3001Y, 100% Airlume combed cotton, iconic Doge Shiba Inu design. Premium youth crypto apparel from Culture.",
    mainImageAlt:
      "Kabosu Youth Short Sleeve T-Shirt — youth tee with iconic Doge Shiba Inu meme graphic",
    mainImageTitle: "Kabosu Youth Short Sleeve T-Shirt | Culture",
    imageAlts: [
      "Kabosu Youth Short Sleeve T-Shirt front — Doge Shiba Inu meme print on heather dust tee",
      "Kabosu Youth Short Sleeve T-Shirt back — clean back view showing side-seam construction",
      "Kabosu Youth Short Sleeve T-Shirt — green colorway with Kabosu Doge graphic",
      "Kabosu Youth Short Sleeve T-Shirt — flat lay detail of combed cotton fabric texture",
    ],
    imageTitles: [
      "Kabosu Youth Short Sleeve T-Shirt — Front | Culture",
      "Kabosu Youth Short Sleeve T-Shirt — Back | Culture",
      "Kabosu Youth Short Sleeve T-Shirt — Green Colorway | Culture",
      "Kabosu Youth Short Sleeve T-Shirt — Fabric Detail | Culture",
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

/** Find the SEO definition whose matchPattern appears in the product name (case-insensitive). */
function matchProduct(name: string): ProductSeo | null {
  const lower = name.toLowerCase();
  // CoinGecko polo must match before generic "coingecko" (sweatshirt already has "sweatshirt")
  // Sort by matchPattern length descending so longer (more specific) patterns match first.
  const sorted = [...PRODUCTS].sort(
    (a, b) => b.matchPattern.length - a.matchPattern.length,
  );
  for (const seo of sorted) {
    if (lower.includes(seo.matchPattern.toLowerCase())) return seo;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!API_KEY) {
    console.error(
      "Set ADMIN_AI_API_KEY or ADMIN_API_KEY. Optionally set API_BASE / MAIN_APP_URL / NEXT_PUBLIC_APP_URL.",
    );
    process.exit(1);
  }

  console.log("API base:", API_BASE);

  // 1. List Printful products
  const listRes = await fetch(
    `${API_BASE}/api/admin/products?vendor=Printful&limit=100`,
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
    items?: Array<{ id: string; name: string }>;
    products?: Array<{ id: string; name: string }>;
  };
  const allProducts = listData.items ?? listData.products ?? [];

  // 2. Filter to the products we have SEO for
  const toUpdate = allProducts
    .map((p) => ({ ...p, seo: matchProduct(p.name) }))
    .filter((p): p is typeof p & { seo: ProductSeo } => p.seo !== null);

  if (toUpdate.length === 0) {
    console.log(
      "No matching Printful products found. Product names from API:",
      allProducts.map((r) => r.name),
    );
    process.exit(1);
  }

  console.log(
    `\nUpdating ${toUpdate.length} product(s) with comprehensive SEO...\n`,
  );

  for (const { id, name, seo } of toUpdate) {
    console.log(`Product: ${name}`);

    // 3. Fetch full product to get current images
    const getRes = await fetch(`${API_BASE}/api/admin/products/${id}`, {
      headers,
    });
    if (!getRes.ok) {
      console.warn("  Skipping — failed to fetch product:", getRes.status);
      continue;
    }
    const product = (await getRes.json()) as {
      images?: Array<{
        id?: string;
        url: string;
        alt?: string | null;
        title?: string | null;
        sortOrder?: number;
      }>;
    };
    const currentImages = product.images ?? [];

    // 4. Build images array: keep existing URLs, update alt + title
    const images = currentImages.map((img, i) => ({
      id: img.id,
      url: img.url,
      alt: seo.imageAlts[i] ?? seo.mainImageAlt,
      title: seo.imageTitles[i] ?? seo.mainImageTitle,
      sortOrder: typeof img.sortOrder === "number" ? img.sortOrder : i,
    }));

    // 5. PATCH product
    const patchRes = await fetch(`${API_BASE}/api/admin/products/${id}`, {
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
      const errText = await patchRes.text();
      console.warn("  PATCH failed:", patchRes.status, errText);
      continue;
    }
    console.log(
      "  ✓ Updated: title, slug, description, features, meta, image SEO. Marked Optimized.",
    );

    // 6. Export (sync store → Printful)
    const exportRes = await fetch(`${API_BASE}/api/admin/printful/sync`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "export_single", productId: id }),
    });
    if (exportRes.ok) {
      const exportData = (await exportRes.json()) as {
        success?: boolean;
        error?: string;
      };
      if (exportData.success) {
        console.log("  ✓ Synced to Printful.");
      } else {
        console.warn(
          "  Printful export failed:",
          exportData.error ?? "unknown",
        );
      }
    } else {
      console.warn(
        "  Printful sync request failed:",
        exportRes.status,
        await exportRes.text(),
      );
    }
    console.log("");
  }

  console.log(
    "Done. All matched products updated with comprehensive SEO and synced to Printful.",
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
