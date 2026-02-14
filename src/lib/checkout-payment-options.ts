/**
 * Payment options config shared between checkout UI and product page accordion.
 * When payment method settings are loaded from GET /api/payment-methods, use
 * getPaymentVisibility(settings) and pass to getPaymentOptionsForDisplay / getPaymentIconPaths.
 */

import type { PaymentMethodSetting } from "~/lib/payment-method-settings";

export const HIDDEN_PAYMENT_OPTIONS = {
  creditCard: true,
  paypal: true,
  cryptoBitcoin: true,
  cryptoDogecoin: true,
  cryptoMonero: true,
} as const;

/** Enabled flags per UI bucket; derived from API settings. Default true when method not in list. */
export type PaymentVisibility = {
  creditCard: boolean;
  paypal: boolean;
  cryptoBitcoin: boolean;
  cryptoDogecoin: boolean;
  cryptoMonero: boolean;
  cryptoEthereum: boolean;
  cryptoSolana: boolean;
  cryptoCrust: boolean;
  cryptoPump: boolean;
  cryptoTroll: boolean;
  cryptoSoluna: boolean;
  cryptoSui: boolean;
  cryptoTon: boolean;
  stablecoinUsdc: boolean;
  stablecoinUsdt: boolean;
  /** For USDC: enabled network keys. Null/empty = all supported. */
  enabledUsdcNetworks: string[] | null;
  /** For USDT: enabled network keys. Null/empty = all supported. */
  enabledUsdtNetworks: string[] | null;
};

const METHOD_KEY_MAP: Record<string, keyof PaymentVisibility> = {
  stripe: "creditCard",
  paypal: "paypal",
  crypto_bitcoin: "cryptoBitcoin",
  crypto_dogecoin: "cryptoDogecoin",
  crypto_ethereum: "cryptoEthereum",
  crypto_solana: "cryptoSolana",
  crypto_monero: "cryptoMonero",
  crypto_crust: "cryptoCrust",
  crypto_pump: "cryptoPump",
  crypto_troll: "cryptoTroll",
  crypto_soluna: "cryptoSoluna",
  crypto_sui: "cryptoSui",
  crypto_ton: "cryptoTon",
  stablecoin_usdc: "stablecoinUsdc",
  stablecoin_usdt: "stablecoinUsdt",
};

const DEFAULT_VISIBILITY: PaymentVisibility = {
  creditCard: true,
  paypal: true,
  cryptoBitcoin: true,
  cryptoDogecoin: true,
  cryptoMonero: true,
  cryptoEthereum: true,
  cryptoSolana: true,
  cryptoCrust: true,
  cryptoPump: true,
  cryptoTroll: true,
  cryptoSoluna: true,
  cryptoSui: true,
  cryptoTon: true,
  stablecoinUsdc: true,
  stablecoinUsdt: true,
  enabledUsdcNetworks: null,
  enabledUsdtNetworks: null,
};

/** Build visibility flags from API payment method settings. Missing methods default to enabled. */
export function getPaymentVisibility(
  settings: PaymentMethodSetting[],
): PaymentVisibility {
  const v = { ...DEFAULT_VISIBILITY };
  for (const s of settings) {
    const key = METHOD_KEY_MAP[s.methodKey];
    if (key && key !== "enabledUsdcNetworks" && key !== "enabledUsdtNetworks") {
      v[key] = s.enabled;
    }
    if (s.methodKey === "stablecoin_usdc") {
      v.enabledUsdcNetworks =
        s.enabledNetworks !== undefined && s.enabledNetworks !== null
          ? s.enabledNetworks
          : null;
    }
    if (s.methodKey === "stablecoin_usdt") {
      v.enabledUsdtNetworks =
        s.enabledNetworks !== undefined && s.enabledNetworks !== null
          ? s.enabledNetworks
          : null;
    }
  }
  return v;
}

/** Hidden flags derived from visibility (for code that still uses "hidden" shape). */
export function getHiddenFromVisibility(v: PaymentVisibility) {
  return {
    creditCard: !v.creditCard,
    paypal: !v.paypal,
    cryptoBitcoin: !v.cryptoBitcoin,
    cryptoDogecoin: !v.cryptoDogecoin,
    cryptoMonero: !v.cryptoMonero,
  };
}

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
  { value: "pump", label: "Pump (PUMP)" },
  { value: "troll", label: "Troll (TROLL)" },
  { value: "soluna", label: "SOLUNA (SOLUNA)" },
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

/** Visible crypto options (filters out hidden). Used when no API visibility is passed. */
export const VISIBLE_CRYPTO_SUB_OPTIONS = CRYPTO_SUB_OPTIONS.filter(
  (opt) =>
    !(
      (opt.value === "bitcoin" && HIDDEN_PAYMENT_OPTIONS.cryptoBitcoin) ||
      (opt.value === "dogecoin" && HIDDEN_PAYMENT_OPTIONS.cryptoDogecoin) ||
      (opt.value === "monero" && HIDDEN_PAYMENT_OPTIONS.cryptoMonero)
    ),
);

/** Visible crypto sub-options for checkout when using API visibility. */
export function visibleCryptoSubFromVisibility(v: PaymentVisibility) {
  return CRYPTO_SUB_OPTIONS.filter((opt) => {
    if (opt.value === "bitcoin") return v.cryptoBitcoin;
    if (opt.value === "dogecoin") return v.cryptoDogecoin;
    if (opt.value === "eth") return v.cryptoEthereum;
    if (opt.value === "solana") return v.cryptoSolana;
    if (opt.value === "monero") return v.cryptoMonero;
    if (opt.value === "crust") return v.cryptoCrust;
    if (opt.value === "pump") return v.cryptoPump;
    if (opt.value === "troll") return v.cryptoTroll;
    if (opt.value === "soluna") return v.cryptoSoluna;
    if (opt.value === "other") return v.cryptoSui || v.cryptoTon;
    return true;
  });
}

export function hasAnyCryptoEnabled(v: PaymentVisibility): boolean {
  return (
    v.cryptoBitcoin ||
    v.cryptoDogecoin ||
    v.cryptoEthereum ||
    v.cryptoSolana ||
    v.cryptoMonero ||
    v.cryptoCrust ||
    v.cryptoPump ||
    v.cryptoTroll ||
    v.cryptoSoluna ||
    v.cryptoSui ||
    v.cryptoTon
  );
}

export function hasAnyStablecoinEnabled(v: PaymentVisibility): boolean {
  return v.stablecoinUsdc || v.stablecoinUsdt;
}

/** USDC network options filtered by admin-enabled networks. Null/empty = all. */
export function visibleUsdcNetworks(v: PaymentVisibility | null): { value: string; label: string }[] {
  const opts = USDC_SUB_OPTIONS;
  if (!v) return opts;
  const allowed = v.enabledUsdcNetworks;
  if (!allowed || allowed.length === 0) return opts;
  return opts.filter((o) => allowed.includes(o.value));
}

/** USDT network options filtered by admin-enabled networks. Null/empty = all. */
export function visibleUsdtNetworks(v: PaymentVisibility | null): { value: string; label: string }[] {
  const opts = USDT_SUB_OPTIONS;
  if (!v) return opts;
  const allowed = v.enabledUsdtNetworks;
  if (!allowed || allowed.length === 0) return opts;
  return opts.filter((o) => allowed.includes(o.value));
}

/** Build crypto payment copy for product accordion: list of accepted cryptocurrencies. */
function getCryptoList(visibility?: PaymentVisibility | null): string[] {
  const opts = visibility
    ? visibleCryptoSubFromVisibility(visibility)
    : VISIBLE_CRYPTO_SUB_OPTIONS;
  const list: string[] = [];
  for (const opt of opts) {
    if (opt.value === "other") {
      if (visibility) {
        if (visibility.cryptoSui) list.push("Sui (SUI)");
        if (visibility.cryptoTon) list.push("TON");
      } else {
        list.push(...OTHER_CRYPTO_OPTIONS.map((o) => o.label));
      }
    } else if (opt.value === "eth") {
      list.push(opt.label);
    } else {
      list.push(opt.label);
    }
  }
  return list;
}

/** Build card payment copy for product accordion. */
function getCardList(visibility?: PaymentVisibility | null): string[] {
  const hideCard = visibility ? !visibility.creditCard : HIDDEN_PAYMENT_OPTIONS.creditCard;
  const hidePaypal = visibility ? !visibility.paypal : HIDDEN_PAYMENT_OPTIONS.paypal;
  if (hideCard && hidePaypal) return [];
  const cards: string[] = [];
  if (!hideCard) {
    cards.push("Visa", "MasterCard", "American Express", "Discover", "Diners");
  }
  if (!hidePaypal) {
    cards.push("PayPal");
  }
  return cards;
}

/** Build stablecoins list for product accordion (network names from visibility). */
function getStablecoinsList(visibility?: PaymentVisibility | null): string[] {
  const list: string[] = [];
  if (visibility) {
    if (visibility.stablecoinUsdc) {
      const usdcOpts = visibleUsdcNetworks(visibility);
      const names = usdcOpts.map((o) => o.label).join(", ");
      list.push(names ? `USDC (${names})` : "USDC");
    }
    if (visibility.stablecoinUsdt) {
      const usdtOpts = visibleUsdtNetworks(visibility);
      const names = usdtOpts.map((o) => o.label).join(", ");
      list.push(names ? `USDT (${names})` : "USDT");
    }
  } else {
    list.push(
      "USDC (Solana, Ethereum, Arbitrum, Base, Polygon)",
      "USDT (Ethereum, Arbitrum, BNB, Polygon)",
    );
  }
  return list;
}

export interface PaymentOptionsForDisplay {
  crypto: string[];
  card: string[];
  stablecoins: string[];
}

/** Payment options derived from checkout config for use on product page accordion. */
export function getPaymentOptionsForDisplay(
  visibility?: PaymentVisibility | null,
): PaymentOptionsForDisplay {
  return {
    crypto: getCryptoList(visibility),
    card: getCardList(visibility),
    stablecoins: getStablecoinsList(visibility),
  };
}

export type PaymentIconItem = { src: string; alt: string; type: "card" | "crypto" };

/** Icon paths for payment methods (for product page "Secure Checkout" strip). Only visible methods. */
export function getPaymentIconPaths(
  visibility?: PaymentVisibility | null,
): PaymentIconItem[] {
  const hideCard = visibility ? !visibility.creditCard : HIDDEN_PAYMENT_OPTIONS.creditCard;
  const icons: PaymentIconItem[] = [];
  if (!hideCard) {
    icons.push(
      { src: "/payments/visa.svg", alt: "Visa", type: "card" },
      { src: "/payments/mastercard.svg", alt: "Mastercard", type: "card" },
      { src: "/payments/amex.svg", alt: "American Express", type: "card" },
    );
  }
  if (visibility) {
    if (visibility.cryptoBitcoin)
      icons.push({ src: "/crypto/bitcoin/bitcoin-logo.svg", alt: "Bitcoin", type: "crypto" });
    if (visibility.cryptoEthereum)
      icons.push({ src: "/crypto/ethereum/ethereum-logo.svg", alt: "Ethereum", type: "crypto" });
    if (visibility.cryptoSolana)
      icons.push({ src: "/crypto/solana/solanaLogoMark.svg", alt: "Solana", type: "crypto" });
    if (visibility.cryptoDogecoin)
      icons.push({ src: "/payments/doge.svg", alt: "Dogecoin", type: "crypto" });
    if (visibility.cryptoMonero)
      icons.push({ src: "/crypto/monero/monero-xmr-logo.svg", alt: "Monero", type: "crypto" });
    if (visibility.cryptoCrust)
      icons.push({ src: "/crypto/solana/solanaLogoMark.svg", alt: "CRUST", type: "crypto" });
    if (visibility.cryptoPump)
      icons.push({ src: "/crypto/pump/pump-logomark.svg", alt: "Pump", type: "crypto" });
    if (visibility.cryptoTroll)
      icons.push({ src: "/crypto/troll/troll-logomark.png", alt: "Troll", type: "crypto" });
    if (visibility.cryptoSoluna)
      icons.push({ src: "/crypto/soluna/soluna-logo.png", alt: "SOLUNA", type: "crypto" });
    if (visibility.stablecoinUsdc)
      icons.push({ src: "/crypto/usdc/usdc-logo.svg", alt: "USDC", type: "crypto" });
    if (visibility.stablecoinUsdt)
      icons.push({ src: "/crypto/usdt/tether-usdt-logo.svg", alt: "USDT", type: "crypto" });
  } else {
    if (!HIDDEN_PAYMENT_OPTIONS.cryptoBitcoin) {
      icons.push({ src: "/crypto/bitcoin/bitcoin-logo.svg", alt: "Bitcoin", type: "crypto" });
    }
    icons.push(
      { src: "/crypto/ethereum/ethereum-logo.svg", alt: "Ethereum", type: "crypto" },
      { src: "/crypto/solana/solanaLogoMark.svg", alt: "Solana", type: "crypto" },
    );
    if (!HIDDEN_PAYMENT_OPTIONS.cryptoDogecoin) {
      icons.push({ src: "/payments/doge.svg", alt: "Dogecoin", type: "crypto" });
    }
    if (!HIDDEN_PAYMENT_OPTIONS.cryptoMonero) {
      icons.push({ src: "/crypto/monero/monero-xmr-logo.svg", alt: "Monero", type: "crypto" });
    }
    icons.push(
      { src: "/crypto/usdc/usdc-logo.svg", alt: "USDC", type: "crypto" },
      { src: "/crypto/usdt/tether-usdt-logo.svg", alt: "USDT", type: "crypto" },
    );
  }
  return icons;
}

/** Footer payment items: same size/format, filtered by checkout visibility. CC logos shown when creditCard OR paypal enabled (PayPal allows CC). */
export function getFooterPaymentItems(
  visibility: PaymentVisibility | null,
): Array<{ name: string; title?: string; src: string }> {
  const showCc =
    visibility !== null
      ? visibility.creditCard || visibility.paypal
      : !HIDDEN_PAYMENT_OPTIONS.creditCard || !HIDDEN_PAYMENT_OPTIONS.paypal;
  const showPaypal =
    visibility !== null ? visibility.paypal : !HIDDEN_PAYMENT_OPTIONS.paypal;

  const items: Array<{ name: string; title?: string; src: string }> = [];

  if (visibility === null) {
    // Before API load: use HIDDEN_PAYMENT_OPTIONS for crypto; always use Solana logo mark
    if (!HIDDEN_PAYMENT_OPTIONS.cryptoBitcoin)
      items.push({ name: "Bitcoin", src: "/payments/bitcoin.svg" });
    if (!HIDDEN_PAYMENT_OPTIONS.cryptoDogecoin)
      items.push({
        name: "Dogecoin",
        title: "Much wow. Such spend.",
        src: "/payments/doge.svg",
      });
    if (!HIDDEN_PAYMENT_OPTIONS.cryptoMonero)
      items.push({ name: "Monero", src: "/payments/monero.svg" });
    items.push({ name: "Ethereum", src: "/payments/ethereum.svg" });
    items.push({ name: "Solana", src: "/crypto/solana/solanaLogoMark.svg" });
    items.push({ name: "Pump", src: "/crypto/pump/pump-logomark.svg" });
    items.push({ name: "Troll", src: "/crypto/troll/troll-logomark.png" });
    items.push({ name: "SOLUNA", src: "/crypto/soluna/soluna-logo.png" });
  } else {
    if (visibility.cryptoBitcoin) items.push({ name: "Bitcoin", src: "/payments/bitcoin.svg" });
    if (visibility.cryptoDogecoin)
      items.push({ name: "Dogecoin", title: "Much wow. Such spend.", src: "/payments/doge.svg" });
    if (visibility.cryptoMonero) items.push({ name: "Monero", src: "/payments/monero.svg" });
    if (visibility.cryptoEthereum) items.push({ name: "Ethereum", src: "/payments/ethereum.svg" });
    if (visibility.cryptoSolana)
      items.push({ name: "Solana", src: "/crypto/solana/solanaLogoMark.svg" });
    if (visibility.cryptoCrust)
      items.push({ name: "Crustafarian", src: "/crypto/solana/solanaLogoMark.svg" });
    if (visibility.cryptoPump)
      items.push({ name: "Pump", src: "/crypto/pump/pump-logomark.svg" });
    if (visibility.cryptoTroll)
      items.push({ name: "Troll", src: "/crypto/troll/troll-logomark.png" });
    if (visibility.cryptoSoluna)
      items.push({ name: "SOLUNA", src: "/crypto/soluna/soluna-logo.png" });
  }

  // Stablecoins (USDC, USDT)
  if (visibility === null) {
    items.push({ name: "USDC", src: "/crypto/usdc/usdc-logo.svg" });
    items.push({ name: "USDT", src: "/crypto/usdt/tether-usdt-logo.svg" });
  } else {
    if (visibility.stablecoinUsdc)
      items.push({ name: "USDC", src: "/crypto/usdc/usdc-logo.svg" });
    if (visibility.stablecoinUsdt)
      items.push({ name: "USDT", src: "/crypto/usdt/tether-usdt-logo.svg" });
  }

  if (showPaypal) items.push({ name: "PayPal", src: "/payments/paypal.svg" });
  if (showCc) {
    items.push({ name: "American Express", src: "/payments/amex.svg" });
    items.push({ name: "Apple Pay", src: "/payments/apple-pay.svg" });
    items.push({ name: "Diners Club", src: "/payments/diners.svg" });
    items.push({ name: "Discover", src: "/payments/discover.svg" });
    items.push({ name: "Google Pay", src: "/payments/google-pay.svg" });
    items.push({ name: "Mastercard", src: "/payments/mastercard.svg" });
    items.push({ name: "Visa", src: "/payments/visa.svg" });
  }

  return items;
}
