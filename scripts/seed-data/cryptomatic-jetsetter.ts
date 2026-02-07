/**
 * Seed data for Cryptomatic THE JETSETTER — Swiss Made limited-edition Bitcoin watch.
 * Sourced from https://cryptomatic.io/
 * One listing with 5 model variants. Price: 0.021 BTC (stored as USD equivalent ~$2,100).
 * Brand: Cryptomatic. Category: Cryptomatic Watches.
 */

/** Approximate USD at seed time; 0.021 BTC. Update or use dynamic pricing as needed. */
const PRICE_USD = 2100;
const PRICE_CENTS = PRICE_USD * 100;

const PRODUCT_ID = "cryptomatic-jetsetter";
const PRODUCT_SLUG = "cryptomatic-the-jetsetter";
const CATEGORY_ID = "accessories-cryptomatic-watches";

/** Base URL for product images (Cryptomatic site; replace with CDN URLs when available). */
const IMG_BASE = "https://cryptomatic.io";

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  {
    url: `${IMG_BASE}/cdn/shop/files/Jetsetter_Main_01.jpg`,
    alt: "Cryptomatic THE JETSETTER Swiss Made watch - Steel and Black",
    title: "THE JETSETTER - Model One",
  },
  {
    url: `${IMG_BASE}/cdn/shop/files/Jetsetter_Model2.jpg`,
    alt: "THE JETSETTER Steel and Orange",
    title: "THE JETSETTER - Model Two",
  },
  {
    url: `${IMG_BASE}/cdn/shop/files/Jetsetter_Model3.jpg`,
    alt: "THE JETSETTER Steel Two-tone Bezel",
    title: "THE JETSETTER - Model Three",
  },
  {
    url: `${IMG_BASE}/cdn/shop/files/Jetsetter_Model4.jpg`,
    alt: "THE JETSETTER Inverse Black and Orange",
    title: "THE JETSETTER - Model Four",
  },
  {
    url: `${IMG_BASE}/cdn/shop/files/Jetsetter_Model5.jpg`,
    alt: "THE JETSETTER Black and Orange",
    title: "THE JETSETTER - Model Five",
  },
];

const OPTION_DEFINITIONS = [
  {
    name: "Model",
    values: [
      "Steel + Black",
      "Steel + Orange",
      "Steel + Two-tone Bezel",
      "Inverse Black + Orange",
      "Black + Orange",
    ],
  },
];

const VARIANTS: Array<{
  id: string;
  color: string;
  priceCents: number;
  sku: string;
  imageUrl: string;
  imageAlt: string;
  imageTitle: string;
  stockQuantity?: number;
}> = [
  {
    id: `${PRODUCT_ID}-steel-black`,
    color: "Steel + Black",
    priceCents: PRICE_CENTS,
    sku: "JETSETTER-01",
    imageUrl: PRODUCT_IMAGES[0]!.url,
    imageAlt: "THE JETSETTER Model One - Steel + Black",
    imageTitle: "THE JETSETTER - Steel + Black",
    stockQuantity: 42,
  },
  {
    id: `${PRODUCT_ID}-steel-orange`,
    color: "Steel + Orange",
    priceCents: PRICE_CENTS,
    sku: "JETSETTER-02",
    imageUrl: PRODUCT_IMAGES[1]!.url,
    imageAlt: "THE JETSETTER Model Two - Steel + Orange",
    imageTitle: "THE JETSETTER - Steel + Orange",
    stockQuantity: 42,
  },
  {
    id: `${PRODUCT_ID}-steel-twotone`,
    color: "Steel + Two-tone Bezel",
    priceCents: PRICE_CENTS,
    sku: "JETSETTER-03",
    imageUrl: PRODUCT_IMAGES[2]!.url,
    imageAlt: "THE JETSETTER Model Three - Steel + Two-tone Bezel",
    imageTitle: "THE JETSETTER - Steel + Two-tone Bezel",
    stockQuantity: 42,
  },
  {
    id: `${PRODUCT_ID}-inverse-black-orange`,
    color: "Inverse Black + Orange",
    priceCents: PRICE_CENTS,
    sku: "JETSETTER-04",
    imageUrl: PRODUCT_IMAGES[3]!.url,
    imageAlt: "THE JETSETTER Model Four - Inverse Black + Orange",
    imageTitle: "THE JETSETTER - Inverse Black + Orange",
    stockQuantity: 42,
  },
  {
    id: `${PRODUCT_ID}-black-orange`,
    color: "Black + Orange",
    priceCents: PRICE_CENTS,
    sku: "JETSETTER-05",
    imageUrl: PRODUCT_IMAGES[4]!.url,
    imageAlt: "THE JETSETTER Model Five - Black + Orange",
    imageTitle: "THE JETSETTER - Black + Orange",
    stockQuantity: 42,
  },
];

const FEATURES: string[] = [
  "Swiss Made — Soprod C125 caliber, automatic winding, 25 jewels, 42h power reserve",
  "40mm case, 48mm lug-to-lug, 11.9mm height, 20mm lug width",
  "Rotating ceramic bezel, sapphire crystal with anti-reflective coating",
  "100m water resistance",
  "24-hour hand for second time zone",
  "316L stainless steel case, Swiss Super-Luminova®",
  "Limited edition of 210 pieces (42 per model)",
  "Italian leather strap + NATO strap + butterfly buckle, travel case included",
];

const DESCRIPTION = `<p>THE JETSETTER is Cryptomatic’s first <strong>Swiss Made</strong> timepiece, powered by the Soprod C125 caliber. A versatile 40mm design with rotating ceramic bezel, sapphire crystal, and 100m water resistance—built for life’s journeys.</p>

<h2>Five models, one collection</h2>
<p>Steel + Black, Steel + Orange, Steel + Two-tone Bezel, Inverse Black + Orange, and Black + Orange. Each limited to 42 pieces.</p>

<h2>Movement</h2>
<p>Caliber Soprod C125 — automatic winding, 25 jewels, 42-hour power reserve, 28,800 A/h. Hour, minutes, hacking seconds, date, and 24-hour hand for a second time zone.</p>

<h2>Specifications</h2>
<ul>
<li><strong>Movement:</strong> Swiss Soprod C125, automatic, 25 jewels, 42h power reserve</li>
<li><strong>Case:</strong> 40mm diameter, 48mm lug-to-lug, 11.9mm height, 20mm lug width</li>
<li><strong>Materials:</strong> 316L stainless steel, sapphire crystal with anti-reflective coating, ceramic bezel</li>
<li><strong>Water resistance:</strong> 100m</li>
<li><strong>Functions:</strong> Hour, minutes, hacking seconds, date, 24-hour hand, rotating ceramic bezel</li>
</ul>

<h2>In the box</h2>
<ul>
<li>1 × JETSETTER Limited Edition timepiece</li>
<li>Italian leather strap with matching butterfly buckle</li>
<li>NATO strap with orange accent and pin buckle</li>
<li>Set of spring bars</li>
<li>Warranty card, cleaning cloth</li>
<li>Canvas and leather travel case</li>
</ul>

<p><strong>Price:</strong> 0.021 BTC (2,100,000 sats). Cryptomatic — Bitcoin only since 2014. Limited edition of 210 watches.</p>`;

export const CRYPTOMATIC_JETSETTER = {
  id: PRODUCT_ID,
  name: "THE JETSETTER — Swiss Made Limited Edition",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
  mainImageAlt: "Cryptomatic THE JETSETTER Swiss Made watch - limited edition",
  mainImageTitle: "THE JETSETTER | Cryptomatic Swiss Made | Culture",
  priceCents: PRICE_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Cryptomatic",
  model: "JETSETTER",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription:
    "THE JETSETTER: Cryptomatic’s first Swiss Made watch. Soprod C125, 40mm, 5 models. Limited edition of 210. 0.021 BTC. Culture.",
  pageTitle: "THE JETSETTER | Cryptomatic Swiss Made Limited Edition | Culture",
  sku: "JETSETTER",
  hasVariants: true,
  optionDefinitions: OPTION_DEFINITIONS,
  variants: VARIANTS,
  continueSellingWhenOutOfStock: false,
  images: PRODUCT_IMAGES,
};
