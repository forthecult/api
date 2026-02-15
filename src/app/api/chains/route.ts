import { NextResponse } from "next/server";

import {
  PUMP_MINT_MAINNET,
  SOLUNA_MINT_MAINNET,
  TROLL_MINT_MAINNET,
  USDC_MINT_MAINNET,
} from "~/lib/solana-pay";

/**
 * Supported chains and tokens for payment. AI agents use this to show
 * "Pay with SOL / USDC / SPL" options without hardcoding mints.
 * GET /api/chains
 */
export async function GET() {
  return NextResponse.json({
    chains: [
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
    ],
  });
}
