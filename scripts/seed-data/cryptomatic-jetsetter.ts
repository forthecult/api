/**
 * Seed data for Cryptomatic THE JETSETTER — Swiss Made limited-edition Bitcoin watch.
 * Sourced from https://cryptomatic.io/
 * One listing with 5 model variants. Price: 0.021 BTC (stored as USD equivalent ~$2,100).
 * Brand: Cryptomatic. Category: Cryptomatic Watches.
 * Shipping: International door-to-door courier (cryptomatic.io/shipping-returns). No product_available_country restriction = available everywhere.
 */

/** Approximate USD at seed time; 0.021 BTC. Update or use dynamic pricing as needed. */
const PRICE_USD = 2100;
const PRICE_CENTS = PRICE_USD * 100;

const PRODUCT_ID = "cryptomatic-jetsetter";
const PRODUCT_SLUG = "cryptomatic-the-jetsetter";
const CATEGORY_ID = "accessories-cryptomatic-watches";

/** Product images from Cryptomatic Squarespace CDN (https://cryptomatic.io). */
const SQSP = "https://images.squarespace-cdn.com/content/v1/6346c0b861def74f44593142";

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  {
    url: `${SQSP}/a837b4f0-2db1-47b1-be04-265ab0809b7a/JET-111_leather.png`,
    alt: "Cryptomatic THE JETSETTER Swiss Made watch - Steel and Black",
    title: "THE JETSETTER - Model One",
  },
  {
    url: `${SQSP}/ad0b48da-1d83-420d-a4ef-06bcda0587ad/JET-112_leather.png`,
    alt: "THE JETSETTER Steel + Black",
    title: "THE JETSETTER - Steel + Black",
  },
  {
    url: `${SQSP}/7e6f8b1a-ad2a-4117-a9e1-0cee62f847c2/JET-121_leather.png`,
    alt: "THE JETSETTER Steel + Orange",
    title: "THE JETSETTER - Steel + Orange",
  },
  {
    url: `${SQSP}/1154a062-9e37-4028-b2ac-20ba79b7a075/JET-213_leather.png`,
    alt: "THE JETSETTER Steel + Two-tone Bezel",
    title: "THE JETSETTER - Steel + Two-tone Bezel",
  },
  {
    url: `${SQSP}/5ccb34a0-fd5b-48ac-ab6e-4857c9131e5d/JET-212_leather.png`,
    alt: "THE JETSETTER Inverse Black + Orange",
    title: "THE JETSETTER - Inverse Black + Orange",
  },
  {
    url: `${SQSP}/0584a882-e97d-45c9-94be-d0b3bace76e5/model+5+%283%29.jpg`,
    alt: "THE JETSETTER Black + Orange",
    title: "THE JETSETTER - Black + Orange",
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
    imageUrl: PRODUCT_IMAGES[5]!.url,
    imageAlt: "THE JETSETTER Model Five - Black + Orange",
    imageTitle: "THE JETSETTER - Black + Orange",
    stockQuantity: 42,
  },
];

const FEATURES: string[] = [
  "Swiss Soprod C125 automatic—25 jewels, 42h reserve, 24h second time zone",
  "40mm 316L steel case, ceramic bezel, sapphire crystal, 100m water resistance",
  "Five dial variants; 42 pieces each (210 total)",
  "Italian leather + NATO strap, travel case included",
  "Cryptomatic—Bitcoin-only since 2014; price in BTC",
];

const DESCRIPTION = `<p>THE JETSETTER is Cryptomatic’s first Swiss Made watch: a 40mm travel-ready piece with a Soprod C125 automatic movement, rotating ceramic bezel, and 100 m water resistance. The dial offers hour, minutes, hacking seconds, date, and a 24-hour hand for a second time zone.</p>

<p>Five models—Steel + Black, Steel + Orange, Steel + Two-tone Bezel, Inverse Black + Orange, and Black + Orange—each limited to 42 pieces. Case is 316L stainless with sapphire crystal and anti-reflective coating; Super-Luminova on hands and indices.</p>

<h2>Specifications</h2>
<ul>
<li><strong>Movement:</strong> Soprod C125, automatic, 28,800 A/h</li>
<li><strong>Case:</strong> 40mm, 48mm lug-to-lug, 11.9mm height, 20mm lugs</li>
<li><strong>In the box:</strong> Watch, Italian leather strap with butterfly buckle, NATO strap, spring bars, warranty card, cleaning cloth, canvas and leather travel case</li>
</ul>

<p>Price: 0.021 BTC. Cryptomatic accepts Bitcoin only.</p>`;

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
