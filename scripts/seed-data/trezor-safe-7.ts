/**
 * Seed data for Trezor Safe 7 hardware wallet.
 * Sourced from https://trezor.io/trezor-safe-7
 * Long-form product page. Brand: Trezor. Category: Hardware Wallets.
 * Shipping: Trezor ships to 200+ countries (shop.trezor.io checkout dropdown). No product_available_country restriction = available everywhere.
 */

const PRICE_CENTS = 21900; // ~$219
const PRODUCT_ID = "trezor-safe-7";
const PRODUCT_SLUG = "trezor-safe-7";
const CATEGORY_ID = "accessories-hardware-wallets";

// Product images from trezor.io/trezor-safe-7 (hero, color variants, device shots only)
const TREZOR_CDN = "https://imagedelivery.net/dvYzklbs_b5YaLRtI16Mnw";
const TREZOR_NEXT = "https://trezor.io/_next/static/media";

export const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  {
    url: `${TREZOR_NEXT}/hero-desktop.31065358.jpg`,
    alt: "Trezor Safe 7 hardware wallet - hero",
    title: "Trezor Safe 7 - Hero",
  },
  {
    url: `${TREZOR_CDN}/eedcd2d7-7754-4386-1480-232d70eb0c00/public`,
    alt: "Trezor Safe 7 - Charcoal Black",
    title: "Trezor Safe 7 - Charcoal Black",
  },
  {
    url: `${TREZOR_CDN}/6d2ac1b9-31e3-4fa5-c56c-decf6bf47500/public`,
    alt: "Trezor Safe 7 - Obsidian Green",
    title: "Trezor Safe 7 - Obsidian Green",
  },
  {
    url: `${TREZOR_NEXT}/black.9bb08b6d.jpg`,
    alt: "Trezor Safe 7 elevated view",
    title: "Trezor Safe 7 - Elevated view",
  },
  {
    url: `${TREZOR_NEXT}/screen-start-desktop.c02078c5.jpg`,
    alt: "Trezor Safe 7 color touchscreen",
    title: "Trezor Safe 7 - Screen",
  },
  {
    url: `${TREZOR_NEXT}/back.c63746cb.jpg`,
    alt: "Trezor Safe 7 back and dimensions",
    title: "Trezor Safe 7 - Back",
  },
  {
    url: `${TREZOR_NEXT}/aluminum-body.32d3d361.jpg`,
    alt: "Trezor Safe 7 premium aluminum unibody",
    title: "Trezor Safe 7 - Aluminum body",
  },
];

const FEATURES: string[] = [
  "TROPIC01 + EAL6+ dual Secure Elements; first auditable secure element",
  "Quantum-ready: post-quantum crypto for firmware and boot",
  "2.5\" color touchscreen, 700 nits; Bluetooth 5.0+ and Qi2 wireless charging",
  "LiFePO₄ battery, IP67, aluminum unibody; 1000s of coins, 70k+ dApps",
  "12–24 word backup, Multi-share option; FIDO2 passkey support",
];

const DESCRIPTION = `<p>The Safe 7 is Trezor’s flagship wallet: two Secure Elements (the open, auditable TROPIC01 plus an EAL6+ chip), post-quantum cryptography for firmware and boot, and a 2.5" high-res color screen. You get strong physical protection and future-ready design in one device.</p>

<p>Use it over Bluetooth or USB-C. Qi2 wireless charging and a LiFePO₄ battery give long life and more charge cycles than typical lithium. The body is anodized aluminum with Gorilla Glass 3 and IP67 rating. Manage thousands of coins and connect to 70k+ dApps via WalletConnect; the Safe 7 also works as a FIDO2 passkey.</p>

<h2>Specifications</h2>
<ul>
<li><strong>Display:</strong> 2.5" color, 520×380 px · <strong>Size:</strong> 75.4×44.5×8.3 mm, 45 g</li>
<li><strong>Connectivity:</strong> Bluetooth 5.0+, USB-C · <strong>Battery:</strong> LiFePO₄, Qi2</li>
</ul>

<h2>In the box</h2>
<p>Trezor Safe 7, USB-C cable, 2× backup cards, start-up and safety guides, stickers.</p>`;

export const TREZOR_SAFE_7 = {
  id: PRODUCT_ID,
  name: "Trezor Safe 7",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url, // hero; upload script will replace with UploadThing
  mainImageAlt: "Trezor Safe 7 hardware wallet - quantum-ready, dual Secure Element",
  mainImageTitle: "Trezor Safe 7 | Hardware Wallet",
  priceCents: PRICE_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Trezor",
  model: "Safe 7",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription:
    "Trezor Safe 7: quantum-ready hardware wallet with TROPIC01 Secure Element, 2.5\" touchscreen, Bluetooth & Qi2 charging. Open-source. Buy at Culture.",
  pageTitle: "Trezor Safe 7 | Hardware Wallet with TROPIC01 | Culture",
  sku: "trezor-safe-7",
  hasVariants: false,
  pageLayout: "long-form" as const,
  continueSellingWhenOutOfStock: true,
  images: PRODUCT_IMAGES,
};
