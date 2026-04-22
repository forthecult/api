/**
 * Supported blockchain chains and tokens for payment. Shared by GET /api/payment-methods
 * and GET /api/payment-methods so payment methods can expand beyond blockchain over time.
 */

import {
  PUMP_MINT_MAINNET,
  SOLUNA_MINT_MAINNET,
  TROLL_MINT_MAINNET,
  USDC_MINT_MAINNET,
} from "~/lib/solana-pay";

export interface ChainToken {
  decimals: number;
  mint?: string;
  name: string;
  symbol: string;
  type: "native" | "spl";
}

export interface SupportedChain {
  id: string;
  name: string;
  tokens: ChainToken[];
}

export function getSupportedChains(): SupportedChain[] {
  return [
    {
      id: "solana",
      name: "Solana",
      tokens: [
        {
          decimals: 9,
          name: "Solana",
          symbol: "SOL",
          type: "native",
        },
        {
          decimals: 6,
          mint: USDC_MINT_MAINNET,
          name: "USD Coin",
          symbol: "USDC",
          type: "spl",
        },
        {
          decimals: 6,
          mint: PUMP_MINT_MAINNET,
          name: "Pump",
          symbol: "PUMP",
          type: "spl",
        },
        {
          decimals: 6,
          mint: TROLL_MINT_MAINNET,
          name: "Trololol",
          symbol: "TROLL",
          type: "spl",
        },
        {
          decimals: 6,
          mint: SOLUNA_MINT_MAINNET,
          name: "SOLUNA",
          symbol: "SOLUNA",
          type: "spl",
        },
      ],
    },
  ];
}
