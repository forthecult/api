import { NextResponse } from "next/server";

import { PUMP_MINT_MAINNET, USDC_MINT_MAINNET } from "~/lib/solana-pay";

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
            symbol: "SOL",
            name: "Solana",
            type: "native",
            decimals: 9,
          },
          {
            symbol: "USDC",
            name: "USD Coin",
            type: "spl",
            mint: USDC_MINT_MAINNET,
            decimals: 6,
          },
          {
            symbol: "PUMP",
            name: "Pump",
            type: "spl",
            mint: PUMP_MINT_MAINNET,
            decimals: 6,
          },
        ],
      },
    ],
  });
}
