/**
 * Seed data for Trezor Safe 7 hardware wallet.
 * Sourced from https://trezor.io/trezor-safe-7
 * Long-form product page. Brand: Trezor. Category: Hardware Wallets.
 */

const PRICE_CENTS = 21900; // ~$219
const PRODUCT_ID = "trezor-safe-7";
const PRODUCT_SLUG = "trezor-safe-7";
const CATEGORY_ID = "accessories-hardware-wallets";

// Official images from trezor.io (product + hero/specs)
const TREZOR_CDN = "https://imagedelivery.net/dvYzklbs_b5YaLRtI16Mnw";
const TREZOR_NEXT = "https://trezor.io/_next/static/media";

export const PRODUCT_IMAGES: Array<{ url: string; alt: string; title: string }> = [
  {
    url: `${TREZOR_CDN}/eedcd2d7-7754-4386-1480-232d70eb0c00/public`,
    alt: "Trezor Safe 7 hardware wallet - Charcoal Black",
    title: "Trezor Safe 7 - Charcoal Black",
  },
  {
    url: `${TREZOR_CDN}/6d2ac1b9-31e3-4fa5-c56c-decf6bf47500/public`,
    alt: "Trezor Safe 7 - Obsidian Green",
    title: "Trezor Safe 7 - Obsidian Green",
  },
  {
    url: `${TREZOR_NEXT}/hero-desktop.31065358.jpg`,
    alt: "Trezor Safe 7 hero - hardware wallet",
    title: "Trezor Safe 7 - Hero",
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
];

const FEATURES: string[] = [
  "TROPIC01—world’s first transparent, auditable Secure Element",
  "Quantum-ready: post-quantum cryptography for firmware and boot",
  "Dual Secure Element (TROPIC01 + EAL6+) for strongest physical protection",
  "2.5\" high-res color touchscreen (520×380 px), 700 nits",
  "Bluetooth 5.0+ and USB-C; Qi2 wireless charging",
  "LiFePO₄ battery—4× charge cycles, long storage life",
  "IP67 dust and water resistant; Gorilla Glass 3",
  "12-, 20-, or 24-word backup; optional Multi-share Backup",
  "1000s of coins & tokens; 70k+ dApps via WalletConnect",
  "FIDO2 passkey / 2FA support",
];

const DESCRIPTION = `<p>The Trezor Safe 7 is the hardware wallet that redefines crypto security. Your crypto, fully protected—today, tomorrow, and beyond.</p>

<h2>Unprecedented security. Unparalleled design.</h2>
<p>The TROPIC01 is the world’s first Secure Element open to anyone to audit and verify. Trezor Safe 7 combines it with an additional NDA-free EAL6+ secure element for the strongest physical protection in the industry.</p>

<h2>Quantum-ready architecture</h2>
<p>Trezor Safe 7 is the only hardware wallet using post-quantum cryptography to secure firmware updates, device authentication, and the boot process—protecting your wallet against future quantum computing threats.</p>

<h2>Wireless freedom</h2>
<p>Manage crypto on any device with open-source encrypted Bluetooth. Qi2-compatible wireless charging and USB-C keep you powered. The LiFePO₄ battery delivers 4× the charging cycles of standard lithium batteries.</p>

<h2>Brilliant high-res color touchscreen</h2>
<p>2.5\" display, 520×380 pixels, 700 nits. Gorilla Glass 3, haptic feedback. Review and sign every transaction with clarity.</p>

<h2>Built to endure</h2>
<p>Premium anodized aluminum unibody, reinforced glass back, IP67-rated. Engineered for excellence.</p>

<h2>Specifications</h2>
<ul>
<li><strong>Dimensions:</strong> 75.4×44.5×8.3 mm / 45 g</li>
<li><strong>Display:</strong> 2.5\" color, 520×380 px</li>
<li><strong>Connectivity:</strong> Bluetooth 5.0+, USB-C</li>
<li><strong>Battery:</strong> LiFePO₄ 3.2V 330mAh, Qi2 wireless charging</li>
<li><strong>Certifications:</strong> CE, RoHS, REACH, WEEE; x-ray safe for air travel</li>
</ul>

<h2>What’s in the box?</h2>
<ul>
<li>Trezor Safe 7 hardware wallet</li>
<li>USB-C → USB-C cable</li>
<li>2× 20-word wallet backup cards</li>
<li>Start-up guide & product safety guide</li>
<li>Trezor stickers</li>
</ul>`;

export const TREZOR_SAFE_7 = {
  id: PRODUCT_ID,
  name: "Trezor Safe 7",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES[0]!.url,
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
