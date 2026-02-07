/**
 * Seed data for Trezor Safe 5 hardware wallet.
 * Sourced from https://trezor.io/trezor-safe-5
 * Long-form product page. Brand: Trezor. Category: Hardware Wallets.
 * Shipping: Trezor ships to 200+ countries (shop.trezor.io). No product_available_country restriction = available everywhere.
 */

const PRICE_CENTS = 16900; // ~$169
const PRODUCT_ID = "trezor-safe-5";
const PRODUCT_SLUG = "trezor-safe-5";
const CATEGORY_ID = "accessories-hardware-wallets";

// Official images from trezor.io (Safe 5 product shots)
const TREZOR_CDN = "https://imagedelivery.net/dvYzklbs_b5YaLRtI16Mnw";

export const PRODUCT_IMAGES_SAFE_5: Array<{ url: string; alt: string; title: string }> = [
  {
    url: `${TREZOR_CDN}/e05a7bf5-a123-4241-535f-571363943e00/public`,
    alt: "Trezor Safe 5 hardware wallet - Black Graphite",
    title: "Trezor Safe 5 - Black Graphite",
  },
  {
    url: `${TREZOR_CDN}/b2c17482-7573-49b9-1ebf-ca12f66ae900/public`,
    alt: "Trezor Safe 5 - front view",
    title: "Trezor Safe 5 - Front",
  },
  {
    url: `${TREZOR_CDN}/eae8bc5c-2403-423f-f2e3-f55795d80300/public`,
    alt: "Trezor Safe 5 - color touchscreen",
    title: "Trezor Safe 5 - Touchscreen",
  },
  {
    url: `${TREZOR_CDN}/f96e0e46-d8dd-4f8f-788e-b3f29190bc00/public`,
    alt: "Trezor Safe 5 - angle view",
    title: "Trezor Safe 5 - Angle",
  },
  {
    url: `${TREZOR_CDN}/3a805404-43bf-446c-fda7-1f378d890000/public`,
    alt: "Trezor Safe 5 - Black Graphite variant",
    title: "Trezor Safe 5 - Black Graphite",
  },
  {
    url: `${TREZOR_CDN}/60a30b71-1f0e-4d32-0be7-926fa20fed00/public`,
    alt: "Trezor Safe 5 - Green Beryl",
    title: "Trezor Safe 5 - Green Beryl",
  },
  {
    url: `${TREZOR_CDN}/0b48cccb-dbc3-4b16-d06e-e24ba2efaa00/public`,
    alt: "Trezor Safe 5 - Violet Ore",
    title: "Trezor Safe 5 - Violet Ore",
  },
];

const FEATURES: string[] = [
  "1.54\" color touchscreen with Trezor Touch haptic feedback",
  "EAL6+ Secure Element—best defense against online and offline threats",
  "Open-source security and design; transparent wallet architecture",
  "PIN & passphrase protection with on-device entry",
  "12-, 20-, or 24-word backup; Advanced Multi-share Backup option",
  "Gorilla Glass 3; scratch-resistant, tamper-evident casing",
  "USB-C connection; Trezor Suite for desktop & mobile",
  "1000s of coins & tokens; compatible with third-party wallet apps",
  "FIDO2—use as a 2FA device",
  "MicroSD card slot for future features",
];

const DESCRIPTION = `<p>The Trezor Safe 5 brings exceptional convenience with a vibrant color touchscreen and confirmation haptic feedback. Seriously secure, intuitively easy.</p>

<h2>View. Tap. Feel. Confirm.</h2>
<p>Your crypto, your control. Absolute control of every transaction with on-device confirmation. Protected by a certified EAL6+ Secure Element.</p>

<h2>Security starts with open-source</h2>
<p>Transparent wallet design makes your Trezor better and safer. PIN and passphrase protection with on-device entry keep your keys under your control.</p>

<h2>Clear & simple wallet backup</h2>
<p>Recover access to your digital assets with 12-, 20-, or 24-word backup. Advanced Multi-share Backup adds an extra layer of recovery protection.</p>

<h2>Manage your crypto in Trezor Suite</h2>
<p>Send, receive, trade, and stake. Track your portfolio and history. Supports 1000s of coins and tokens.</p>

<h2>Specifications</h2>
<ul>
<li><strong>Display:</strong> 1.54\" color, 240×240 px</li>
<li><strong>Security:</strong> EAL6+ Secure Element, open-source</li>
<li><strong>Dimensions:</strong> 65.9×40×8 mm / 23 g</li>
<li><strong>Connectivity:</strong> USB-C</li>
<li><strong>Certifications:</strong> CE, RoHS; x-ray safe for air travel</li>
</ul>

<h2>What’s in the box?</h2>
<ul>
<li>Trezor Safe 5 hardware wallet</li>
<li>USB-C → USB-C cable</li>
<li>2× 20-word wallet backup cards</li>
<li>Start-up guide</li>
<li>Trezor stickers</li>
</ul>`;

export const TREZOR_SAFE_5 = {
  id: PRODUCT_ID,
  name: "Trezor Safe 5",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES_SAFE_5[0]!.url,
  mainImageAlt: "Trezor Safe 5 hardware wallet - color touchscreen, Secure Element",
  mainImageTitle: "Trezor Safe 5 | Secure Crypto Hardware Wallet",
  priceCents: PRICE_CENTS,
  categoryId: CATEGORY_ID,
  brand: "Trezor",
  model: "Safe 5",
  description: DESCRIPTION,
  features: FEATURES,
  metaDescription:
    "Trezor Safe 5: secure crypto hardware wallet with color touchscreen, EAL6+ Secure Element, haptic feedback. Open-source. Buy at Culture.",
  pageTitle: "Trezor Safe 5 | Secure Crypto Hardware Wallet | Culture",
  sku: "trezor-safe-5",
  hasVariants: false,
  pageLayout: "long-form" as const,
  continueSellingWhenOutOfStock: true,
  images: PRODUCT_IMAGES_SAFE_5,
};
