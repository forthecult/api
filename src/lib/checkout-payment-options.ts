/**
 * Payment options config shared between checkout UI and product page accordion.
 * When payment method settings are loaded from GET /api/payment-methods, use
 * getPaymentVisibility(settings) and pass to getPaymentOptionsForDisplay / getPaymentIconPaths.
 */

import type { PaymentMethodSetting } from "~/lib/payment-method-settings";

export const HIDDEN_PAYMENT_OPTIONS = {
  creditCard: true,
  cryptoBitcoin: true,
  cryptoDogecoin: true,
  cryptoMonero: true,
  paypal: true,
} as const;

/** Enabled flags per UI bucket; derived from API settings. Default true when method not in list. */
export interface PaymentVisibility {
  creditCard: boolean;
  cryptoBitcoin: boolean;
  cryptoBnb: boolean;
  cryptoCrust: boolean;
  cryptoCult: boolean;
  cryptoDogecoin: boolean;
  cryptoEthereum: boolean;
  cryptoMonero: boolean;
  cryptoPump: boolean;
  cryptoSeeker: boolean;
  cryptoSolana: boolean;
  cryptoSoluna: boolean;
  cryptoSui: boolean;
  cryptoTon: boolean;
  cryptoTroll: boolean;
  /** For USDC: enabled network keys. Null/empty = all supported. */
  enabledUsdcNetworks: null | string[];
  /** For USDT: enabled network keys. Null/empty = all supported. */
  enabledUsdtNetworks: null | string[];
  paypal: boolean;
  stablecoinUsdc: boolean;
  stablecoinUsdt: boolean;
}

const METHOD_KEY_MAP: Record<string, keyof PaymentVisibility> = {
  crypto_bitcoin: "cryptoBitcoin",
  crypto_bnb: "cryptoBnb",
  crypto_crust: "cryptoCrust",
  crypto_cult: "cryptoCult",
  crypto_dogecoin: "cryptoDogecoin",
  crypto_ethereum: "cryptoEthereum",
  crypto_monero: "cryptoMonero",
  crypto_pump: "cryptoPump",
  crypto_seeker: "cryptoSeeker",
  crypto_solana: "cryptoSolana",
  crypto_soluna: "cryptoSoluna",
  crypto_sui: "cryptoSui",
  crypto_ton: "cryptoTon",
  crypto_troll: "cryptoTroll",
  paypal: "paypal",
  stablecoin_usdc: "stablecoinUsdc",
  stablecoin_usdt: "stablecoinUsdt",
  stripe: "creditCard",
};

/** BTCPay (Bitcoin, Dogecoin, Monero) is not implemented yet — always disabled. */
const BTCPAY_DISABLED = true;

const DEFAULT_VISIBILITY: PaymentVisibility = {
  creditCard: true,
  cryptoBitcoin: false, // BTCPay not implemented
  cryptoBnb: true,
  cryptoCrust: true,
  cryptoCult: true,
  cryptoDogecoin: false, // BTCPay not implemented
  cryptoEthereum: true,
  cryptoMonero: false, // BTCPay not implemented
  cryptoPump: true,
  cryptoSeeker: true,
  cryptoSolana: true,
  cryptoSoluna: true,
  cryptoSui: true,
  cryptoTon: true,
  cryptoTroll: true,
  enabledUsdcNetworks: null,
  enabledUsdtNetworks: null,
  paypal: true,
  stablecoinUsdc: true,
  stablecoinUsdt: true,
};

/** Hidden flags derived from visibility (for code that still uses "hidden" shape). */
export function getHiddenFromVisibility(v: PaymentVisibility) {
  return {
    creditCard: !v.creditCard,
    cryptoBitcoin: !v.cryptoBitcoin,
    cryptoDogecoin: !v.cryptoDogecoin,
    cryptoMonero: !v.cryptoMonero,
    paypal: !v.paypal,
  };
}

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
  // BTCPay not implemented — never show Bitcoin, Dogecoin, Monero regardless of admin
  if (BTCPAY_DISABLED) {
    v.cryptoBitcoin = false;
    v.cryptoDogecoin = false;
    v.cryptoMonero = false;
  }
  return v;
}

const CRYPTO_SUB_OPTIONS: {
  label: string;
  value: string;
}[] = [
  { label: "Bitcoin (BTC)", value: "bitcoin" },
  { label: "Culture (CULT)", value: "cult" },
  { label: "Dogecoin (DOGE)", value: "dogecoin" },
  { label: "Ethereum (ETH)", value: "eth" },
  { label: "Monero (XMR)", value: "monero" },
  { label: "Solana (SOL)", value: "solana" },
  { label: "Crustafarian (CRUST)", value: "crust" },
  { label: "Pump (PUMP)", value: "pump" },
  { label: "Seeker (SKR)", value: "seeker" },
  { label: "SOLUNA (SOLUNA)", value: "soluna" },
  { label: "Troll (TROLL)", value: "troll" },
  { label: "Other", value: "other" },
];

const OTHER_CRYPTO_OPTIONS: { label: string; value: string }[] = [
  { label: "Sui (SUI)", value: "sui" },
  { label: "TON", value: "ton" },
];

const _ETH_CHAIN_OPTIONS: { label: string; value: string }[] = [
  { label: "ETH (Ethereum)", value: "ethereum" },
  { label: "ETH (Arbitrum)", value: "arbitrum" },
  { label: "ETH (Base)", value: "base" },
  { label: "ETH (Polygon)", value: "polygon" },
];

const USDC_SUB_OPTIONS: { label: string; value: string }[] = [
  { label: "USDC (Solana)", value: "solana" },
  { label: "USDC (Ethereum)", value: "ethereum" },
  { label: "USDC (Arbitrum)", value: "arbitrum" },
  { label: "USDC (Base)", value: "base" },
  { label: "USDC (Polygon)", value: "polygon" },
];

const USDT_SUB_OPTIONS: { label: string; value: string }[] = [
  { label: "USDT (Ethereum)", value: "ethereum" },
  { label: "USDT (Arbitrum)", value: "arbitrum" },
  { label: "USDT (BNB Smart Chain)", value: "bnb" },
  { label: "USDT (Polygon)", value: "polygon" },
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

export interface PaymentIconItem {
  alt: string;
  src: string;
  type: "card" | "crypto";
}

export interface PaymentOptionsForDisplay {
  card: string[];
  crypto: string[];
  stablecoins: string[];
}

/** Footer payment items: same size/format, filtered by checkout visibility. CC logos shown when creditCard OR paypal enabled (PayPal allows CC). */
export function getFooterPaymentItems(
  visibility: null | PaymentVisibility,
): { name: string; src: string; title?: string }[] {
  const showCc =
    visibility !== null
      ? visibility.creditCard || visibility.paypal
      : !HIDDEN_PAYMENT_OPTIONS.creditCard || !HIDDEN_PAYMENT_OPTIONS.paypal;
  const showPaypal =
    visibility !== null ? visibility.paypal : !HIDDEN_PAYMENT_OPTIONS.paypal;

  const items: { name: string; src: string; title?: string }[] = [];

  if (visibility === null) {
    // Before API load: use HIDDEN_PAYMENT_OPTIONS for crypto; always use Solana logo mark
    if (!HIDDEN_PAYMENT_OPTIONS.cryptoBitcoin)
      items.push({ name: "Bitcoin", src: "/payments/bitcoin.svg" });
    if (!HIDDEN_PAYMENT_OPTIONS.cryptoDogecoin)
      items.push({
        name: "Dogecoin",
        src: "/payments/doge.svg",
        title: "Much wow. Such spend.",
      });
    if (!HIDDEN_PAYMENT_OPTIONS.cryptoMonero)
      items.push({ name: "Monero", src: "/payments/monero.svg" });
    items.push({ name: "Ethereum", src: "/payments/ethereum.svg" });
    items.push({ name: "Solana", src: "/crypto/solana/solanaLogoMark.svg" });
    items.push({
      name: "Crustafarian",
      src: "/crypto/crustafarianism/crust-logo.png",
    });
    items.push({ name: "Pump", src: "/crypto/pump/pump-logomark.svg" });
    items.push({ name: "Troll", src: "/crypto/troll/troll-logomark.png" });
    items.push({
      name: "Seeker (SKR)",
      src: "/crypto/seeker/S_Token_Circle_White.svg",
    });
    items.push({
      name: "Culture (CULT)",
      src: "/crypto/cult/cult-logo.svg",
    });
  } else {
    if (visibility.cryptoBitcoin)
      items.push({ name: "Bitcoin", src: "/payments/bitcoin.svg" });
    if (visibility.cryptoDogecoin)
      items.push({
        name: "Dogecoin",
        src: "/payments/doge.svg",
        title: "Much wow. Such spend.",
      });
    if (visibility.cryptoMonero)
      items.push({ name: "Monero", src: "/payments/monero.svg" });
    if (visibility.cryptoEthereum)
      items.push({ name: "Ethereum", src: "/payments/ethereum.svg" });
    if (visibility.cryptoSolana)
      items.push({ name: "Solana", src: "/crypto/solana/solanaLogoMark.svg" });
    if (visibility.cryptoCrust)
      items.push({
        name: "Crustafarian",
        src: "/crypto/crustafarianism/crust-logo.png",
      });
    if (visibility.cryptoPump)
      items.push({ name: "Pump", src: "/crypto/pump/pump-logomark.svg" });
    if (visibility.cryptoTroll)
      items.push({ name: "Troll", src: "/crypto/troll/troll-logomark.png" });
    if (visibility.cryptoSeeker)
      items.push({
        name: "Seeker (SKR)",
        src: "/crypto/seeker/S_Token_Circle_White.svg",
      });
    if (visibility.cryptoCult)
      items.push({
        name: "Culture (CULT)",
        src: "/crypto/cult/cult-logo.svg",
      });
    if (visibility.cryptoBnb)
      items.push({ name: "BNB", src: "/crypto/bnb/bnb-smart-chain.svg" });
    if (visibility.cryptoTon)
      items.push({ name: "TON", src: "/crypto/ton/ton_logo.svg" });
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

  // After crypto: Google Pay, Apple Pay
  if (showCc) {
    items.push({ name: "Google Pay", src: "/payments/google-pay.svg" });
    items.push({ name: "Apple Pay", src: "/payments/apple-pay.svg" });
  }

  // PayPal
  if (showPaypal) items.push({ name: "PayPal", src: "/payments/paypal.svg" });

  // Credit cards last: visa, mastercard, diners, discover, amex
  if (showCc) {
    items.push({ name: "Visa", src: "/payments/visa.svg" });
    items.push({ name: "Mastercard", src: "/payments/mastercard.svg" });
    items.push({ name: "Diners Club", src: "/payments/diners.svg" });
    items.push({ name: "Discover", src: "/payments/discover.svg" });
    items.push({ name: "American Express", src: "/payments/amex.svg" });
  }

  return items;
}

/**
 * Logos for the product PDP "Payment options" accordion: group by section for
 * conversion-focused layout (card + wallets, then stablecoins, then other crypto).
 */
export function getPaymentLogosByAccordionSection(
  visibility: null | PaymentVisibility,
): {
  cardAndWallets: { name: string; src: string }[];
  cryptos: { name: string; src: string }[];
  stablecoins: { name: string; src: string }[];
} {
  const all = getFooterPaymentItems(visibility);
  const cardNames = new Set([
    "Visa",
    "Mastercard",
    "Diners Club",
    "Discover",
    "American Express",
    "Google Pay",
    "Apple Pay",
    "PayPal",
  ]);
  const cardAndWallets: { name: string; src: string }[] = [];
  const stablecoins: { name: string; src: string }[] = [];
  const cryptos: { name: string; src: string }[] = [];
  for (const item of all) {
    if (item.name === "USDC" || item.name === "USDT") {
      if (!stablecoins.some((s) => s.name === item.name))
        stablecoins.push(item);
      continue;
    }
    if (cardNames.has(item.name)) {
      if (!cardAndWallets.some((c) => c.name === item.name)) {
        cardAndWallets.push(item);
      }
      continue;
    }
    if (!cryptos.some((c) => c.name === item.name)) cryptos.push(item);
  }
  return { cardAndWallets, cryptos, stablecoins };
}

/** Icon paths for payment methods (for product page "Secure Checkout" strip). Only visible methods. */
export function getPaymentIconPaths(
  visibility?: null | PaymentVisibility,
): PaymentIconItem[] {
  const hideCard = visibility
    ? !visibility.creditCard
    : HIDDEN_PAYMENT_OPTIONS.creditCard;
  const icons: PaymentIconItem[] = [];
  if (!hideCard) {
    icons.push(
      { alt: "Visa", src: "/payments/visa.svg", type: "card" },
      { alt: "Mastercard", src: "/payments/mastercard.svg", type: "card" },
      { alt: "Diners Club", src: "/payments/diners.svg", type: "card" },
      { alt: "Discover", src: "/payments/discover.svg", type: "card" },
      { alt: "American Express", src: "/payments/amex.svg", type: "card" },
    );
  }
  if (visibility) {
    if (visibility.cryptoBitcoin)
      icons.push({
        alt: "Bitcoin",
        src: "/crypto/bitcoin/bitcoin-logo.svg",
        type: "crypto",
      });
    if (visibility.cryptoEthereum)
      icons.push({
        alt: "Ethereum",
        src: "/crypto/ethereum/ethereum-logo.svg",
        type: "crypto",
      });
    if (visibility.cryptoSolana)
      icons.push({
        alt: "Solana",
        src: "/crypto/solana/solanaLogoMark.svg",
        type: "crypto",
      });
    if (visibility.cryptoDogecoin)
      icons.push({
        alt: "Dogecoin",
        src: "/payments/doge.svg",
        type: "crypto",
      });
    if (visibility.cryptoMonero)
      icons.push({
        alt: "Monero",
        src: "/crypto/monero/monero-xmr-logo.svg",
        type: "crypto",
      });
    if (visibility.cryptoCrust)
      icons.push({
        alt: "CRUST",
        src: "/crypto/crustafarianism/crust-logo.png",
        type: "crypto",
      });
    if (visibility.cryptoPump)
      icons.push({
        alt: "Pump",
        src: "/crypto/pump/pump-logomark.svg",
        type: "crypto",
      });
    if (visibility.cryptoTroll)
      icons.push({
        alt: "Troll",
        src: "/crypto/troll/troll-logomark.png",
        type: "crypto",
      });
    if (visibility.cryptoSoluna)
      icons.push({
        alt: "SOLUNA",
        src: "/crypto/soluna/soluna-logo.png",
        type: "crypto",
      });
    if (visibility.cryptoSeeker)
      icons.push({
        alt: "Seeker (SKR)",
        src: "/crypto/seeker/S_Token_Circle_White.svg",
        type: "crypto",
      });
    if (visibility.cryptoCult)
      icons.push({
        alt: "Culture (CULT)",
        src: "/crypto/cult/cult-logo.svg",
        type: "crypto",
      });
    if (visibility.cryptoBnb)
      icons.push({
        alt: "BNB",
        src: "/crypto/bnb/bnb-smart-chain.svg",
        type: "crypto",
      });
    if (visibility.cryptoTon)
      icons.push({
        alt: "TON",
        src: "/crypto/ton/ton_logo.svg",
        type: "crypto",
      });
    if (visibility.stablecoinUsdc)
      icons.push({
        alt: "USDC",
        src: "/crypto/usdc/usdc-logo.svg",
        type: "crypto",
      });
    if (visibility.stablecoinUsdt)
      icons.push({
        alt: "USDT",
        src: "/crypto/usdt/tether-usdt-logo.svg",
        type: "crypto",
      });
  } else {
    if (!HIDDEN_PAYMENT_OPTIONS.cryptoBitcoin) {
      icons.push({
        alt: "Bitcoin",
        src: "/crypto/bitcoin/bitcoin-logo.svg",
        type: "crypto",
      });
    }
    icons.push(
      {
        alt: "Ethereum",
        src: "/crypto/ethereum/ethereum-logo.svg",
        type: "crypto",
      },
      {
        alt: "Solana",
        src: "/crypto/solana/solanaLogoMark.svg",
        type: "crypto",
      },
    );
    if (!HIDDEN_PAYMENT_OPTIONS.cryptoDogecoin) {
      icons.push({
        alt: "Dogecoin",
        src: "/payments/doge.svg",
        type: "crypto",
      });
    }
    if (!HIDDEN_PAYMENT_OPTIONS.cryptoMonero) {
      icons.push({
        alt: "Monero",
        src: "/crypto/monero/monero-xmr-logo.svg",
        type: "crypto",
      });
    }
    icons.push(
      { alt: "USDC", src: "/crypto/usdc/usdc-logo.svg", type: "crypto" },
      { alt: "USDT", src: "/crypto/usdt/tether-usdt-logo.svg", type: "crypto" },
    );
  }
  return icons;
}

/** Payment options derived from checkout config for use on product page accordion. */
export function getPaymentOptionsForDisplay(
  visibility?: null | PaymentVisibility,
): PaymentOptionsForDisplay {
  return {
    card: getCardList(visibility),
    crypto: getCryptoList(visibility),
    stablecoins: getStablecoinsList(visibility),
  };
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
    v.cryptoSeeker ||
    v.cryptoCult ||
    v.cryptoSui ||
    v.cryptoTon
  );
}

export function hasAnyStablecoinEnabled(v: PaymentVisibility): boolean {
  return v.stablecoinUsdc || v.stablecoinUsdt;
}

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
    if (opt.value === "seeker") return v.cryptoSeeker;
    if (opt.value === "cult") return v.cryptoCult;
    if (opt.value === "other") return v.cryptoSui || v.cryptoTon;
    return true;
  });
}

/** USDC network options filtered by admin-enabled networks. Null/empty = all. */
export function visibleUsdcNetworks(
  v: null | PaymentVisibility,
): { label: string; value: string }[] {
  const opts = USDC_SUB_OPTIONS;
  if (!v) return opts;
  const allowed = v.enabledUsdcNetworks;
  if (!allowed || allowed.length === 0) return opts;
  return opts.filter((o) => allowed.includes(o.value));
}

/** USDT network options filtered by admin-enabled networks. Null/empty = all. */
export function visibleUsdtNetworks(
  v: null | PaymentVisibility,
): { label: string; value: string }[] {
  const opts = USDT_SUB_OPTIONS;
  if (!v) return opts;
  const allowed = v.enabledUsdtNetworks;
  if (!allowed || allowed.length === 0) return opts;
  return opts.filter((o) => allowed.includes(o.value));
}

/** Build card payment copy for product accordion. */
function getCardList(visibility?: null | PaymentVisibility): string[] {
  const hideCard = visibility
    ? !visibility.creditCard
    : HIDDEN_PAYMENT_OPTIONS.creditCard;
  const hidePaypal = visibility
    ? !visibility.paypal
    : HIDDEN_PAYMENT_OPTIONS.paypal;
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

/** Build crypto payment copy for product accordion: list of accepted cryptocurrencies. */
function getCryptoList(visibility?: null | PaymentVisibility): string[] {
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

/** Build stablecoins list for product accordion (network names from visibility). */
function getStablecoinsList(visibility?: null | PaymentVisibility): string[] {
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
