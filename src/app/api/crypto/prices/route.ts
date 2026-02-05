/**
 * All crypto prices in USD: single CoinGecko call (BTC, ETH, SOL, DOGE, etc.) + CRUST via pump.fun.
 * Cached 60s (ISR). Used by CryptoCurrencyProvider so client makes one request.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { getCoinGeckoSimplePrice } from "~/lib/coingecko";
import { getPumpTokenPriceInSol } from "~/lib/pump-price";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";

const CRUST_MINT_MAINNET = "HkBWJJiaUW5Kod4HpHWZiGD9PQVipmMiPDgiRPcNpump";

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
  XMR: 150,
  XAU: 2650,
};

export async function GET() {
  const FETCH_TIMEOUT = 5000; // 5 second timeout for external APIs

  try {
    // Fetch via shared client (60s cache, 30/min rate limit)
    const d = await getCoinGeckoSimplePrice(COINGECKO_IDS);
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

    // Fetch CRUST price with separate timeout (don't block main response)
    const solUsd = d?.solana?.usd;
    if (typeof solUsd === "number" && solUsd > 0) {
      try {
        const crustPromise = (async () => {
          const connection = new Connection(getSolanaRpcUrlServer());
          const crustMint = new PublicKey(CRUST_MINT_MAINNET);
          return await getPumpTokenPriceInSol(connection, crustMint);
        })();

        // Race against timeout
        const solPerToken = await Promise.race([
          crustPromise,
          new Promise<number>((resolve) =>
            setTimeout(() => resolve(0), FETCH_TIMEOUT),
          ),
        ]);

        if (solPerToken > 0) prices.CRUST = solPerToken * solUsd;
      } catch {
        // CRUST price fetch failed, continue without it
      }
    }

    return NextResponse.json(prices);
  } catch {
    return NextResponse.json(FALLBACK_PRICES);
  }
}
