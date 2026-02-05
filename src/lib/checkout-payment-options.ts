/**
 * Payment options config shared between checkout UI and product page accordion.
 * Keep in sync with CheckoutClient payment method options.
 */

export const HIDDEN_PAYMENT_OPTIONS = {
  creditCard: true,
  paypal: true,
  cryptoBitcoin: true,
  cryptoDogecoin: true,
  cryptoMonero: true,
} as const;

const CRYPTO_SUB_OPTIONS: {
  value: string;
  label: string;
}[] = [
  { value: "bitcoin", label: "Bitcoin (BTC)" },
  { value: "dogecoin", label: "Dogecoin (DOGE)" },
  { value: "eth", label: "Ethereum (ETH)" },
  { value: "solana", label: "Solana (SOL)" },
  { value: "monero", label: "Monero (XMR)" },
  { value: "crust", label: "Crustafarian (CRUST)" },
  { value: "other", label: "Other" },
];

const OTHER_CRYPTO_OPTIONS: { value: string; label: string }[] = [
  { value: "sui", label: "Sui (SUI)" },
  { value: "ton", label: "TON" },
];

const ETH_CHAIN_OPTIONS: { value: string; label: string }[] = [
  { value: "ethereum", label: "ETH (Ethereum)" },
  { value: "arbitrum", label: "ETH (Arbitrum)" },
  { value: "base", label: "ETH (Base)" },
  { value: "polygon", label: "ETH (Polygon)" },
];

const USDC_SUB_OPTIONS: { value: string; label: string }[] = [
  { value: "solana", label: "USDC (Solana)" },
  { value: "ethereum", label: "USDC (Ethereum)" },
  { value: "arbitrum", label: "USDC (Arbitrum)" },
  { value: "base", label: "USDC (Base)" },
  { value: "polygon", label: "USDC (Polygon)" },
];

const USDT_SUB_OPTIONS: { value: string; label: string }[] = [
  { value: "ethereum", label: "USDT (Ethereum)" },
  { value: "arbitrum", label: "USDT (Arbitrum)" },
  { value: "bnb", label: "USDT (BNB Smart Chain)" },
  { value: "polygon", label: "USDT (Polygon)" },
];

/** Visible crypto options (filters out hidden). */
export const VISIBLE_CRYPTO_SUB_OPTIONS = CRYPTO_SUB_OPTIONS.filter(
  (opt) =>
    !(
      (opt.value === "bitcoin" && HIDDEN_PAYMENT_OPTIONS.cryptoBitcoin) ||
      (opt.value === "dogecoin" && HIDDEN_PAYMENT_OPTIONS.cryptoDogecoin) ||
      (opt.value === "monero" && HIDDEN_PAYMENT_OPTIONS.cryptoMonero)
    ),
);

/** Build crypto payment copy for product accordion: list of accepted cryptocurrencies. */
function getCryptoList(): string[] {
  const list: string[] = [];
  for (const opt of VISIBLE_CRYPTO_SUB_OPTIONS) {
    if (opt.value === "other") {
      list.push(...OTHER_CRYPTO_OPTIONS.map((o) => o.label));
    } else if (opt.value === "eth") {
      list.push(opt.label); // "Ethereum (ETH)" only — network choice is at checkout
    } else {
      list.push(opt.label);
    }
  }
  return list;
}

/** Build card payment copy for product accordion. */
function getCardList(): string[] {
  if (HIDDEN_PAYMENT_OPTIONS.creditCard && HIDDEN_PAYMENT_OPTIONS.paypal)
    return [];
  const cards: string[] = [];
  if (!HIDDEN_PAYMENT_OPTIONS.creditCard) {
    cards.push("Visa", "MasterCard", "American Express", "Discover", "Diners");
  }
  if (!HIDDEN_PAYMENT_OPTIONS.paypal) {
    cards.push("PayPal");
  }
  return cards;
}

/** Build stablecoins list for product accordion. */
function getStablecoinsList(): string[] {
  const list: string[] = ["USDC (Solana, Ethereum, Arbitrum, Base, Polygon)", "USDT (Ethereum, Arbitrum, BNB, Polygon)"];
  return list;
}

export interface PaymentOptionsForDisplay {
  crypto: string[];
  card: string[];
  stablecoins: string[];
}

/** Payment options derived from checkout config for use on product page accordion. */
export function getPaymentOptionsForDisplay(): PaymentOptionsForDisplay {
  return {
    crypto: getCryptoList(),
    card: getCardList(),
    stablecoins: getStablecoinsList(),
  };
}

/** Icon paths for payment methods (for product page "Secure Checkout" strip). Only visible methods. */
export function getPaymentIconPaths(): { src: string; alt: string }[] {
  const icons: { src: string; alt: string }[] = [];
  if (!HIDDEN_PAYMENT_OPTIONS.creditCard) {
    icons.push(
      { src: "/payments/visa.svg", alt: "Visa" },
      { src: "/payments/mastercard.svg", alt: "Mastercard" },
      { src: "/payments/amex.svg", alt: "American Express" },
    );
  }
  if (!HIDDEN_PAYMENT_OPTIONS.cryptoBitcoin) {
    icons.push({ src: "/crypto/bitcoin/bitcoin-logo.svg", alt: "Bitcoin" });
  }
  icons.push(
    { src: "/crypto/ethereum/ethereum-logo.svg", alt: "Ethereum" },
    { src: "/crypto/solana/solanaLogoMark.svg", alt: "Solana" },
  );
  if (!HIDDEN_PAYMENT_OPTIONS.cryptoDogecoin) {
    icons.push({ src: "/payments/doge.svg", alt: "Dogecoin" });
  }
  if (!HIDDEN_PAYMENT_OPTIONS.cryptoMonero) {
    icons.push({ src: "/crypto/monero/monero-xmr-logo.svg", alt: "Monero" });
  }
  icons.push(
    { src: "/crypto/usdc/usdc-logo.svg", alt: "USDC" },
    { src: "/crypto/usdt/tether-usdt-logo.svg", alt: "USDT" },
  );
  return icons;
}
