/**
 * All crypto prices in USD: CoinGecko (BTC, ETH, SOL, DOGE, etc. + PUMP token by contract) + CRUST via pump.fun.
 * Cached 60s (ISR). Used by CryptoCurrencyProvider so client makes one request.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

import {
  getCoinGeckoSimplePrice,
  getCoinGeckoTokenPrice,
} from "~/lib/coingecko";
import { getPumpTokenPriceInSol } from "~/lib/pump-price";
import {
  getSolanaRpcUrlServer,
  CRUST_MINT_MAINNET,
  PUMP_MINT_MAINNET,
} from "~/lib/solana-pay";

const COINGECKO_IDS = [
  "bitcoin",
  "ethereum",
  "solana",
  "dogecoin",
  "toncoin",
  "monero",
  "pax-gold",
  "kinesis-silver",
];

export const revalidate = 60;

export type CryptoPricesResponse = {
  BTC?: number;
  ETH?: number;
  SOL?: number;
  DOGE?: number;
  TON?: number;
  CRUST?: number;
  PUMP?: number;
  TROLL?: number;
  XMR?: number;
  /** Gold (XAU) spot USD per troy oz via PAX Gold (PAXG) */
  XAU?: number;
  /** Silver (XAG) USD per troy oz via Kinesis Silver (KAG) */
  XAG?: number;
};

// Fallback prices to return immediately if external APIs are slow (XAU = USD per troy oz)
const FALLBACK_PRICES: CryptoPricesResponse = {
  BTC: 100000,
  ETH: 3500,
  SOL: 200,
  DOGE: 0.35,
  TON: 5.5,
  CRUST: 0.0001,
  PUMP: 0.01,
  TROLL: 1,
  XMR: 150,
  XAU: 2650,
};

export async function GET() {
  const FETCH_TIMEOUT = 5000; // 5 second timeout for external APIs

  try {
    // Fetch via shared client (60s cache, 30/min rate limit)
    const [d, pumpTokenPrices] = await Promise.all([
      getCoinGeckoSimplePrice(COINGECKO_IDS),
      getCoinGeckoTokenPrice("solana", [PUMP_MINT_MAINNET]),
    ]);

    if (!d) {
      return NextResponse.json(FALLBACK_PRICES);
    }

    const prices: CryptoPricesResponse = {};
    if (d?.bitcoin?.usd) prices.BTC = d.bitcoin.usd;
    if (d?.ethereum?.usd) prices.ETH = d.ethereum.usd;
    if (d?.solana?.usd) prices.SOL = d.solana.usd;
    if (d?.dogecoin?.usd) prices.DOGE = d.dogecoin.usd;
    if (d?.toncoin?.usd) prices.TON = d.toncoin.usd;
    if (d?.monero?.usd) prices.XMR = d.monero.usd;
    if (d?.["pax-gold"]?.usd) prices.XAU = d["pax-gold"].usd;
    if (d?.["kinesis-silver"]?.usd) prices.XAG = d["kinesis-silver"].usd;

    // PUMP: prefer CoinGecko token price (keys are often lowercase); fallback to pump.fun DEX if missing
    const pumpEntry =
      pumpTokenPrices?.[PUMP_MINT_MAINNET.toLowerCase()] ??
      pumpTokenPrices?.[PUMP_MINT_MAINNET];
    if (pumpEntry?.usd != null && pumpEntry.usd > 0) {
      prices.PUMP = pumpEntry.usd;
    }

    // CRUST via pump.fun LP (no CoinGecko listing); PUMP fallback from pump.fun when CoinGecko doesn't return it
    const solUsd = d?.solana?.usd;
    if (typeof solUsd === "number" && solUsd > 0) {
      try {
        const connection = new Connection(getSolanaRpcUrlServer());
        const [crustSolPerToken, pumpSolPerToken] = await Promise.all([
          Promise.race([
            getPumpTokenPriceInSol(connection, new PublicKey(CRUST_MINT_MAINNET)),
            new Promise<number>((resolve) =>
              setTimeout(() => resolve(0), FETCH_TIMEOUT),
            ),
          ]),
          // Only fetch PUMP from pump.fun if CoinGecko didn't return it
          prices.PUMP != null && prices.PUMP > 0
            ? Promise.resolve(0)
            : Promise.race([
                getPumpTokenPriceInSol(connection, new PublicKey(PUMP_MINT_MAINNET)),
                new Promise<number>((resolve) =>
                  setTimeout(() => resolve(0), FETCH_TIMEOUT),
                ),
              ]),
        ]);
        if (crustSolPerToken > 0) prices.CRUST = crustSolPerToken * solUsd;
        if (pumpSolPerToken > 0 && (prices.PUMP == null || prices.PUMP <= 0)) {
          prices.PUMP = pumpSolPerToken * solUsd;
        }
      } catch {
        // pump.fun price fetch failed, continue with CoinGecko-only prices
      }
    }

    // TROLL: 1 USD placeholder (wire real price feed when available)
    if (prices.TROLL == null || prices.TROLL <= 0) {
      prices.TROLL = 1;
    }

    return NextResponse.json(prices);
  } catch {
    return NextResponse.json(FALLBACK_PRICES);
  }
}
