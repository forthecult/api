/**
 * Seed data for Trezor Safe 5 hardware wallet.
 * Sourced from https://trezor.io/trezor-safe-5
 * Long-form product page. Brand: Trezor. Category: Hardware Wallets.
 * Shipping: Trezor ships to 200+ countries (shop.trezor.io). No product_available_country restriction = available everywhere.
 */

const PRICE_CENTS = 16900; // ~$169
const PRODUCT_ID = "trezor-safe-5";
const PRODUCT_SLUG = "trezor-safe-5";
const CATEGORY_ID = "hardware-wallets";

// Official images from trezor.io (Safe 5 product shots)
const TREZOR_CDN = "https://imagedelivery.net/dvYzklbs_b5YaLRtI16Mnw";

export const PRODUCT_IMAGES_SAFE_5: Array<{
  url: string;
  alt: string;
  title: string;
}> = [
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
  '1.54" color touchscreen with haptic feedback for confirmations',
  "EAL6+ Secure Element; open-source firmware and design",
  "12-, 20-, or 24-word backup; optional Multi-share Backup",
  "USB-C; Trezor Suite for desktop and mobile; 1000s of coins",
  "FIDO2 capable; Gorilla Glass 3, CE/RoHS; x-ray safe for travel",
];

const DESCRIPTION = `<p>The Safe 5 is Trezor’s compact hardware wallet: confirm every transaction on a color touchscreen with haptic feedback, while keys stay in an EAL6+ Secure Element. No cloud, no closed code—firmware and design are open source so you can verify how your crypto is protected.</p>

<p>Set a PIN and optional passphrase on the device. Back up with 12, 20, or 24 words, or use Advanced Multi-share Backup for extra recovery options. Use Trezor Suite to send, receive, trade, and stake across a huge range of coins and tokens; the device also works as a FIDO2 2FA key.</p>

<h2>Specifications</h2>
<ul>
<li><strong>Display:</strong> 1.54" color, 240×240 px</li>
<li><strong>Size:</strong> 65.9×40×8 mm, 23 g · USB-C</li>
</ul>

<h2>In the box</h2>
<p>Trezor Safe 5, USB-C cable, 2× backup cards, start-up guide, stickers.</p>`;

export const TREZOR_SAFE_5 = {
  id: PRODUCT_ID,
  name: "Trezor Safe 5",
  slug: PRODUCT_SLUG,
  imageUrl: PRODUCT_IMAGES_SAFE_5[0]!.url,
  mainImageAlt:
    "Trezor Safe 5 hardware wallet - color touchscreen, Secure Element",
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
