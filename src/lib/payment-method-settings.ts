/**
 * Payment method keys and labels. Used by admin UI and API.
 * When a method is disabled in admin, it is hidden from checkout and product pages.
 */
export const PAYMENT_METHOD_DEFAULTS: Array<{
  methodKey: string;
  label: string;
  displayOrder: number;
}> = [
  { methodKey: "stripe", label: "Stripe (Credit / Debit card)", displayOrder: 0 },
  { methodKey: "paypal", label: "PayPal", displayOrder: 1 },
  { methodKey: "crypto_bitcoin", label: "Bitcoin (BTC)", displayOrder: 10 },
  { methodKey: "crypto_dogecoin", label: "Dogecoin (DOGE)", displayOrder: 11 },
  { methodKey: "crypto_ethereum", label: "Ethereum (ETH)", displayOrder: 12 },
  { methodKey: "crypto_solana", label: "Solana (SOL)", displayOrder: 13 },
  { methodKey: "crypto_monero", label: "Monero (XMR)", displayOrder: 14 },
  { methodKey: "crypto_crust", label: "Crustafarian (CRUST)", displayOrder: 15 },
  { methodKey: "crypto_pump", label: "Pump (PUMP)", displayOrder: 16 },
  { methodKey: "crypto_troll", label: "Troll (TROLL)", displayOrder: 17 },
  { methodKey: "crypto_soluna", label: "SOLUNA (SOLUNA)", displayOrder: 18 },
  { methodKey: "crypto_sui", label: "Sui (SUI)", displayOrder: 19 },
  { methodKey: "crypto_ton", label: "TON", displayOrder: 20 },
  { methodKey: "stablecoin_usdc", label: "USDC (Stablecoin)", displayOrder: 21 },
  { methodKey: "stablecoin_usdt", label: "USDT (Stablecoin)", displayOrder: 22 },
];

/** Network options for payment methods that support multiple networks. Used by admin and checkout. */
export const PAYMENT_METHOD_NETWORKS: Record<
  string,
  { value: string; label: string }[]
> = {
  stablecoin_usdc: [
    { value: "solana", label: "Solana" },
    { value: "ethereum", label: "Ethereum" },
    { value: "arbitrum", label: "Arbitrum" },
    { value: "base", label: "Base" },
    { value: "polygon", label: "Polygon" },
  ],
  stablecoin_usdt: [
    { value: "ethereum", label: "Ethereum" },
    { value: "arbitrum", label: "Arbitrum" },
    { value: "bnb", label: "BNB Smart Chain" },
    { value: "polygon", label: "Polygon" },
  ],
};

export type PaymentMethodSetting = {
  methodKey: string;
  label: string;
  enabled: boolean;
  /** For multi-network methods: enabled network keys. Null/empty = all supported. */
  enabledNetworks?: string[] | null;
  displayOrder: number;
};
