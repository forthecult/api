/** Token gate type: CULT with default qty, CULT with custom qty, or other token. */
export type TokenGateType = "cult_custom" | "cult_default" | "other";

export const TOKEN_GATE_NETWORKS = [
  { label: "Solana", value: "solana" },
  { label: "Ethereum", value: "ethereum" },
  { label: "Base", value: "base" },
  { label: "Arbitrum", value: "arbitrum" },
  { label: "BNB Smart Chain", value: "bnb" },
  { label: "Polygon", value: "polygon" },
  { label: "Avalanche", value: "avalanche" },
] as const;

export const TOKEN_GATE_TYPES: { label: string; value: TokenGateType }[] = [
  {
    label: "CULT token (default quantity — set globally later)",
    value: "cult_default",
  },
  {
    label: "Manual quantity of CULT (unique to this page)",
    value: "cult_custom",
  },
  { label: "Another token (network + contract address)", value: "other" },
];
