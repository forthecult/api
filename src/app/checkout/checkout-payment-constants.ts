/**
 * Pure data constants for checkout payment options (crypto, USDC, USDT, etc.).
 * Keeps CheckoutClient and PaymentMethodSection free of option list clutter.
 */

/** Fallback when payment method API has not loaded; hide card/paypal/crypto by default. */
export const HIDDEN_PAYMENT_OPTIONS = {
  creditCard: true,
  cryptoBitcoin: true,
  cryptoDogecoin: true,
  cryptoMonero: true,
  paypal: true,
} as const;

/** Top-level crypto options; "eth" = nested chain choices, "other" = Sui, TON, etc. */
export const CRYPTO_SUB_OPTIONS: {
  label: string;
  value:
    | "bitcoin"
    | "crust"
    | "cult"
    | "dogecoin"
    | "eth"
    | "monero"
    | "other"
    | "pump"
    | "seeker"
    | "solana"
    | "soluna"
    | "troll";
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

/** Crypto sub-options visible in UI when using fallback (hidden options filtered out). */
export const VISIBLE_CRYPTO_SUB_OPTIONS = CRYPTO_SUB_OPTIONS.filter((opt) => {
  if (opt.value === "bitcoin" && HIDDEN_PAYMENT_OPTIONS.cryptoBitcoin)
    return false;
  if (opt.value === "dogecoin" && HIDDEN_PAYMENT_OPTIONS.cryptoDogecoin)
    return false;
  if (opt.value === "monero" && HIDDEN_PAYMENT_OPTIONS.cryptoMonero)
    return false;
  return true;
});

export const INITIAL_CRYPTO_SUB = (VISIBLE_CRYPTO_SUB_OPTIONS[0]?.value ??
  "eth") as
  | "bitcoin"
  | "crust"
  | "cult"
  | "dogecoin"
  | "eth"
  | "monero"
  | "other"
  | "pump"
  | "seeker"
  | "solana"
  | "soluna"
  | "troll";

/** Options under Crypto → Other */
export const OTHER_SUB_OPTIONS: { label: string; value: "sui" | "ton" }[] = [
  { label: "Sui (SUI)", value: "sui" },
  { label: "TON", value: "ton" },
];

/** Chains under Crypto → Ethereum (ETH) */
export const ETH_CHAIN_OPTIONS: {
  label: string;
  value: "arbitrum" | "base" | "ethereum" | "polygon";
}[] = [
  { label: "ETH (Ethereum)", value: "ethereum" },
  { label: "ETH (Arbitrum)", value: "arbitrum" },
  { label: "ETH (Base)", value: "base" },
  { label: "ETH (Polygon)", value: "polygon" },
];

/** Crypto option value → logo path (top-level and other sub-options) */
export const CRYPTO_LOGO_SRC: Partial<
  Record<
    | "bitcoin"
    | "crust"
    | "cult"
    | "dogecoin"
    | "eth"
    | "monero"
    | "other"
    | "pump"
    | "seeker"
    | "solana"
    | "soluna"
    | "sui"
    | "ton"
    | "troll",
    string
  >
> = {
  bitcoin: "/crypto/bitcoin/bitcoin-logo.svg",
  crust: "/crypto/crustafarianism/crust-logo.png",
  cult: "/crypto/cult/cult-logo.svg",
  dogecoin: "/payments/doge.svg",
  eth: "/crypto/ethereum/ethereum-logo.svg",
  monero: "/crypto/monero/monero-xmr-logo.svg",
  pump: "/crypto/pump/pump-logomark.svg",
  seeker: "/crypto/seeker/S_Token_Circle_White.svg",
  solana: "/crypto/solana/solanaLogoMark.svg",
  soluna: "/crypto/soluna/soluna-logo.png",
  sui: "/crypto/sui/sui-logo.svg",
  ton: "/crypto/ton/ton_logo.svg",
  troll: "/crypto/troll/troll-logomark.png",
};

export const USDC_SUB_OPTIONS: {
  label: string;
  value: "arbitrum" | "base" | "ethereum" | "polygon" | "solana";
}[] = [
  { label: "USDC (Solana)", value: "solana" },
  { label: "USDC (Ethereum)", value: "ethereum" },
  { label: "USDC (Arbitrum)", value: "arbitrum" },
  { label: "USDC (Base)", value: "base" },
  { label: "USDC (Polygon)", value: "polygon" },
];

export const USDT_SUB_OPTIONS: {
  label: string;
  value: "arbitrum" | "bnb" | "ethereum" | "polygon";
}[] = [
  { label: "USDT (Ethereum)", value: "ethereum" },
  { label: "USDT (Arbitrum)", value: "arbitrum" },
  { label: "USDT (BNB Smart Chain)", value: "bnb" },
  { label: "USDT (Polygon)", value: "polygon" },
];

/** Chain logo for stablecoin network options (USDC/USDT). Solana and EVM chains. */
export const STABLECOIN_CHAIN_LOGO: Record<
  "arbitrum" | "base" | "bnb" | "ethereum" | "polygon" | "solana",
  string
> = {
  arbitrum: "/crypto/ethereum/ethereum-logo.svg",
  base: "/crypto/ethereum/ethereum-logo.svg",
  bnb: "/crypto/bnb/bnb-smart-chain.svg",
  ethereum: "/crypto/ethereum/ethereum-logo.svg",
  polygon: "/crypto/polygon/polygon-logo.svg",
  solana: "/crypto/solana/solanaLogoMark.svg",
};

/** Stablecoin token logo (for USDC / USDT labels). */
export const STABLECOIN_TOKEN_LOGO = {
  usdc: "/crypto/usdc/usdc-logo.svg",
  usdt: "/crypto/usdt/tether-usdt-logo.svg",
} as const;
