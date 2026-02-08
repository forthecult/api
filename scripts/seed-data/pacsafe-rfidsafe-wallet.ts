/**
 * Seed data for Pacsafe® RFIDsafe™ RFID blocking card wallet.
 * Sourced from https://pacsafe.com/products/pacsafe-rfidsafe-rfid-blocking-card-wallet
 * Pacsafe list price = our cost; sell at 4% above ($29.95 → $31.15). Brand: Pacsafe. Category: Travel Accessories.
 */

const LIST_PRICE_USD = 29.95;
const PRICE_MARKUP = 1.04;
const COST_CENTS = Math.round(LIST_PRICE_USD * 100);
const PRICE_CENTS = Math.round(LIST_PRICE_USD * PRICE_MARKUP * 100);

const CDN = "https://cdn.shopify.com/s/files/1/0041/7638/0013/files";

const PRODUCT_ID = "pacsafe-rfidsafe-card-wallet";
const PRODUCT_SLUG = "pacsafe-rfidsafe-rfid-blocking-card-wallet";
const CATEGORY_ID = "accessories-travel";

const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  { url: `${CDN}/RFIDsafe_CardWallet_11085340_Rose_1.jpg?v=1768982782`, alt: "Pacsafe RFIDsafe RFID blocking card wallet, Rose", title: "Pacsafe RFIDsafe Card Wallet - Rose" },
  { url: `${CDN}/RFIDsafe_CardWallet.jpg?v=1768982782`, alt: "Pacsafe RFIDsafe card wallet - compact RFID blocking", title: "Pacsafe RFIDsafe Card Wallet" },
  { url: `${CDN}/RFIDsafe_CardWallet_11085340_Rose_2.jpg?v=1768982782`, alt: "Pacsafe RFIDsafe wallet interior and card slots", title: "Pacsafe RFIDsafe - Interior" },
  { url: `${CDN}/RFIDsafe_CardWallet_11085660_CoastalBlue_1.jpg?v=1768982782`, alt: "Pacsafe RFIDsafe RFID blocking card wallet, Coastal Blue", title: "Pacsafe RFIDsafe - Coastal Blue" },
  { url: `${CDN}/RFIDsafe_CardWallet_11085130_JetBlack_1.jpg?v=1768982782`, alt: "Pacsafe RFIDsafe RFID blocking card wallet, Jet Black", title: "Pacsafe RFIDsafe - Jet Black" },
  { url: `${CDN}/RFIDsafe_CardWallet_11085146_Stone_1.jpg?v=1768982782`, alt: "Pacsafe RFIDsafe RFID blocking card wallet, Stone", title: "Pacsafe RFIDsafe - Stone" },
];

const FEATURES: string[] = [
  "RFID-blocking material protects cards from skimming",
  "Hidden pocket for bills or backup cards; holds up to 10 cards",
  "External slot for transit or tap-to-pay card",
  "Clip or strap attachment (strap sold separately); recycled, PFC-free",
  "2-year warranty",
];

const DESCRIPTION = `<p>A slim card wallet that keeps daily carry organized and your cards protected from RFID skimming. Three main slots plus a hidden pocket give you room for cards and a bit of cash; the hidden pocket works well for separating currencies when you travel. An external slot gives one-tap access to a transit or payment card.</p>

<p>Clip it inside a Pacsafe bag or add an optional cut-resistant strap to wear as a wristlet or micro crossbody. Shell and lining are recycled polyester with PFC-free water repellency—about two plastic bottles’ worth of rPET per wallet.</p>

<p><strong>Dimensions:</strong> 4.3 × 3.2 × 0.8 in · <strong>Weight:</strong> 0.1 lb. 2-year warranty on accessories.</p>`;

const OPTION_DEFINITIONS = [{ name: "Color", values: ["Rose", "Fresh Mint", "Garnet Red", "Stone", "Jet Black", "Coastal Blue"] }];

const VARIANTS: Array<{ id: string; color: string; priceCents: number; sku: string; imageUrl: string; imageAlt: string; imageTitle: string }> = [
  { id: `${PRODUCT_ID}-rose`, color: "Rose", priceCents: PRICE_CENTS, sku: "11085340", imageUrl: `${CDN}/RFIDsafe_CardWallet_11085340_Rose_1.jpg?v=1768982782`, imageAlt: "Pacsafe RFIDsafe RFID blocking card wallet, Rose", imageTitle: "Pacsafe RFIDsafe Card Wallet - Rose" },
  { id: `${PRODUCT_ID}-fresh-mint`, color: "Fresh Mint", priceCents: PRICE_CENTS, sku: "11085528", imageUrl: `${CDN}/RFIDsafe_CardWallet_11085340_Rose_1.jpg?v=1768982782`, imageAlt: "Pacsafe RFIDsafe RFID blocking card wallet, Fresh Mint", imageTitle: "Pacsafe RFIDsafe Card Wallet - Fresh Mint" },
  { id: `${PRODUCT_ID}-garnet-red`, color: "Garnet Red", priceCents: PRICE_CENTS, sku: "11085345", imageUrl: `${CDN}/RFIDsafe_CardWallet_11085340_Rose_1.jpg?v=1768982782`, imageAlt: "Pacsafe RFIDsafe RFID blocking card wallet, Garnet Red", imageTitle: "Pacsafe RFIDsafe Card Wallet - Garnet Red" },
  { id: `${PRODUCT_ID}-stone`, color: "Stone", priceCents: PRICE_CENTS, sku: "11085146", imageUrl: `${CDN}/RFIDsafe_CardWallet_11085146_Stone_1.jpg?v=1768982782`, imageAlt: "Pacsafe RFIDsafe RFID blocking card wallet, Stone", imageTitle: "Pacsafe RFIDsafe Card Wallet - Stone" },
  { id: `${PRODUCT_ID}-jet-black`, color: "Jet Black", priceCents: PRICE_CENTS, sku: "11085130", imageUrl: `${CDN}/RFIDsafe_CardWallet_11085130_JetBlack_1.jpg?v=1768982782`, imageAlt: "Pacsafe RFIDsafe RFID blocking card wallet, Jet Black", imageTitle: "Pacsafe RFIDsafe Card Wallet - Jet Black" },
  { id: `${PRODUCT_ID}-coastal-blue`, color: "Coastal Blue", priceCents: PRICE_CENTS, sku: "11085660", imageUrl: `${CDN}/RFIDsafe_CardWallet_11085660_CoastalBlue_1.jpg?v=1768982782`, imageAlt: "Pacsafe RFIDsafe RFID blocking card wallet, Coastal Blue", imageTitle: "Pacsafe RFIDsafe Card Wallet - Coastal Blue" },
];

export const PACSAFE_RFIDSAFE_WALLET = {
  id: PRODUCT_ID,
  name: "Pacsafe® RFIDsafe™ RFID blocking card wallet",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
  mainImageAlt: "Pacsafe RFIDsafe RFID blocking card wallet - compact travel card wallet",
  mainImageTitle: "Pacsafe RFIDsafe RFID Blocking Card Wallet",
  priceCents: PRICE_CENTS,
  costPerItemCents: COST_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Pacsafe",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription: "Pacsafe RFIDsafe RFID blocking card wallet—fits up to 10 cards, hidden pocket, transport card slot. Recycled materials. Shop at Culture.",
  pageTitle: "Pacsafe RFIDsafe RFID Blocking Card Wallet | Travel Wallet | Culture",
  sku: "11085340",
  weightGrams: 45,
  weightUnit: "lb" as const,
  images: PRODUCT_IMAGES,
  hasVariants: true,
  optionDefinitions: OPTION_DEFINITIONS,
  variants: VARIANTS,
  /** North America store: US & Canada only (pacsafe.com/pages/shipping). */
  availableCountryCodes: ["US", "CA"] as const,
};
