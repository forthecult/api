/** Token gate type: CULT with default qty, CULT with custom qty, or other token. */
export type TokenGateType = "cult_default" | "cult_custom" | "other";

export const TOKEN_GATE_NETWORKS = [
  { value: "solana", label: "Solana" },
  { value: "ethereum", label: "Ethereum" },
  { value: "base", label: "Base" },
  { value: "arbitrum", label: "Arbitrum" },
  { value: "bnb", label: "BNB Smart Chain" },
  { value: "polygon", label: "Polygon" },
  { value: "avalanche", label: "Avalanche" },
] as const;

export const TOKEN_GATE_TYPES: { value: TokenGateType; label: string }[] = [
  {
    value: "cult_default",
    label: "CULT token (default quantity — set globally later)",
  },
  {
    value: "cult_custom",
    label: "Manual quantity of CULT (unique to this page)",
  },
  { value: "other", label: "Another token (network + contract address)" },
];
