/**
 * Pure data constants for checkout payment options (crypto, USDC, USDT, etc.).
 * Keeps CheckoutClient and PaymentMethodSection free of option list clutter.
 */

/** Fallback when payment method API has not loaded; hide card/paypal/crypto by default. */
export const HIDDEN_PAYMENT_OPTIONS = {
  creditCard: true,
  paypal: true,
  cryptoBitcoin: true,
  cryptoDogecoin: true,
  cryptoMonero: true,
} as const;

/** Top-level crypto options; "eth" = nested chain choices, "other" = Sui, TON, etc. */
export const CRYPTO_SUB_OPTIONS: {
  value:
    | "bitcoin"
    | "dogecoin"
    | "eth"
    | "solana"
    | "monero"
    | "crust"
    | "pump"
    | "troll"
    | "soluna"
    | "seeker"
    | "other";
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
  { value: "seeker", label: "Seeker (SKR)" },
  { value: "other", label: "Other" },
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
  | "dogecoin"
  | "eth"
  | "solana"
  | "monero"
  | "crust"
  | "pump"
  | "troll"
  | "soluna"
  | "seeker"
  | "other";

/** Options under Crypto → Other */
export const OTHER_SUB_OPTIONS: { value: "sui" | "ton"; label: string }[] = [
  { value: "sui", label: "Sui (SUI)" },
  { value: "ton", label: "TON" },
];

/** Chains under Crypto → Ethereum (ETH) */
export const ETH_CHAIN_OPTIONS: {
  value: "ethereum" | "arbitrum" | "base" | "polygon";
  label: string;
}[] = [
  { value: "ethereum", label: "ETH (Ethereum)" },
  { value: "arbitrum", label: "ETH (Arbitrum)" },
  { value: "base", label: "ETH (Base)" },
  { value: "polygon", label: "ETH (Polygon)" },
];

/** Crypto option value → logo path (top-level and other sub-options) */
export const CRYPTO_LOGO_SRC: Partial<
  Record<
    | "bitcoin"
    | "dogecoin"
    | "eth"
    | "solana"
    | "sui"
    | "ton"
    | "monero"
    | "crust"
    | "pump"
    | "troll"
    | "soluna"
    | "seeker"
    | "other",
    string
  >
> = {
  bitcoin: "/crypto/bitcoin/bitcoin-logo.svg",
  dogecoin: "/payments/doge.svg",
  eth: "/crypto/ethereum/ethereum-logo.svg",
  solana: "/crypto/solana/solanaLogoMark.svg",
  sui: "/crypto/sui/sui-logo.svg",
  ton: "/crypto/ton/ton_logo.svg",
  monero: "/crypto/monero/monero-xmr-logo.svg",
  crust: "/crypto/solana/solanaLogoMark.svg",
  pump: "/crypto/pump/pump-logomark.svg",
  troll: "/crypto/troll/troll-logomark.png",
  soluna: "/crypto/soluna/soluna-logo.png",
  seeker: "/crypto/seeker/S_Token_Circle_White.svg",
};

export const USDC_SUB_OPTIONS: {
  value: "solana" | "ethereum" | "arbitrum" | "base" | "polygon";
  label: string;
}[] = [
  { value: "solana", label: "USDC (Solana)" },
  { value: "ethereum", label: "USDC (Ethereum)" },
  { value: "arbitrum", label: "USDC (Arbitrum)" },
  { value: "base", label: "USDC (Base)" },
  { value: "polygon", label: "USDC (Polygon)" },
];

export const USDT_SUB_OPTIONS: {
  value: "ethereum" | "arbitrum" | "bnb" | "polygon";
  label: string;
}[] = [
  { value: "ethereum", label: "USDT (Ethereum)" },
  { value: "arbitrum", label: "USDT (Arbitrum)" },
  { value: "bnb", label: "USDT (BNB Smart Chain)" },
  { value: "polygon", label: "USDT (Polygon)" },
];

/** Chain logo for stablecoin network options (USDC/USDT). Solana and EVM chains. */
export const STABLECOIN_CHAIN_LOGO: Record<
  "solana" | "ethereum" | "arbitrum" | "base" | "polygon" | "bnb",
  string
> = {
  solana: "/crypto/solana/solanaLogoMark.svg",
  ethereum: "/crypto/ethereum/ethereum-logo.svg",
  arbitrum: "/crypto/ethereum/ethereum-logo.svg",
  base: "/crypto/ethereum/ethereum-logo.svg",
  polygon: "/crypto/polygon/polygon-logo.svg",
  bnb: "/crypto/bnb/bnb-smart-chain.svg",
};

/** Stablecoin token logo (for USDC / USDT labels). */
export const STABLECOIN_TOKEN_LOGO = {
  usdc: "/crypto/usdc/usdc-logo.svg",
  usdt: "/crypto/usdt/tether-usdt-logo.svg",
} as const;
