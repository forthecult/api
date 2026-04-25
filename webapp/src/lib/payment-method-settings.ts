/**
 * Payment method keys and labels. Used by admin UI and API.
 * When a method is disabled in admin, it is hidden from checkout and product pages.
 */
export const PAYMENT_METHOD_DEFAULTS: {
  displayOrder: number;
  label: string;
  methodKey: string;
}[] = [
  {
    displayOrder: 0,
    label: "Stripe (Credit / Debit card)",
    methodKey: "stripe",
  },
  { displayOrder: 1, label: "PayPal", methodKey: "paypal" },
  { displayOrder: 10, label: "Bitcoin (BTC)", methodKey: "crypto_bitcoin" },
  { displayOrder: 11, label: "Dogecoin (DOGE)", methodKey: "crypto_dogecoin" },
  { displayOrder: 12, label: "Ethereum (ETH)", methodKey: "crypto_ethereum" },
  { displayOrder: 13, label: "Solana (SOL)", methodKey: "crypto_solana" },
  { displayOrder: 14, label: "Monero (XMR)", methodKey: "crypto_monero" },
  {
    displayOrder: 15,
    label: "Crustafarian (CRUST)",
    methodKey: "crypto_crust",
  },
  { displayOrder: 16, label: "Pump (PUMP)", methodKey: "crypto_pump" },
  { displayOrder: 17, label: "Troll (TROLL)", methodKey: "crypto_troll" },
  { displayOrder: 18, label: "SOLUNA (SOLUNA)", methodKey: "crypto_soluna" },
  { displayOrder: 19, label: "Seeker (SKR)", methodKey: "crypto_seeker" },
  /** Between Seeker and Sui; must stay integer (DB column is `integer`). */
  { displayOrder: 20, label: "Culture (CULT)", methodKey: "crypto_cult" },
  { displayOrder: 21, label: "Sui (SUI)", methodKey: "crypto_sui" },
  { displayOrder: 22, label: "TON", methodKey: "crypto_ton" },
  {
    displayOrder: 23,
    label: "USDC (Stablecoin)",
    methodKey: "stablecoin_usdc",
  },
  {
    displayOrder: 24,
    label: "USDT (Stablecoin)",
    methodKey: "stablecoin_usdt",
  },
];

/** Network options for payment methods that support multiple networks. Used by admin and checkout. */
export const PAYMENT_METHOD_NETWORKS: Record<
  string,
  { label: string; value: string }[]
> = {
  stablecoin_usdc: [
    { label: "Solana", value: "solana" },
    { label: "Ethereum", value: "ethereum" },
    { label: "Arbitrum", value: "arbitrum" },
    { label: "Base", value: "base" },
    { label: "Polygon", value: "polygon" },
  ],
  stablecoin_usdt: [
    { label: "Ethereum", value: "ethereum" },
    { label: "Arbitrum", value: "arbitrum" },
    { label: "BNB Smart Chain", value: "bnb" },
    { label: "Polygon", value: "polygon" },
  ],
};

export interface PaymentMethodSetting {
  displayOrder: number;
  enabled: boolean;
  /** For multi-network methods: enabled network keys. Null/empty = all supported. */
  enabledNetworks?: null | string[];
  label: string;
  methodKey: string;
}

/** Coerce to a non-negative integer for DB `display_order` (Postgres `integer`). */
export function toPaymentMethodDisplayOrder(displayOrder: number): number {
  return Math.max(0, Math.round(displayOrder));
}
