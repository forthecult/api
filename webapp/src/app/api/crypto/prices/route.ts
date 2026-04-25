/**
 * All crypto prices in USD: CoinGecko (BTC, ETH, SOL, DOGE, etc. + PUMP/SKR by contract) + CRUST etc. via pump.fun.
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
  CRUST_MINT_MAINNET,
  CULT_MINT_MAINNET,
  getSolanaRpcUrlServer,
  PUMP_MINT_MAINNET,
  SKR_MINT_MAINNET,
  SOLUNA_MINT_MAINNET,
  TROLL_MINT_MAINNET,
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
  "binancecoin",
];

export const revalidate = 60;

export interface CryptoPricesResponse {
  BNB?: number;
  BTC?: number;
  CRUST?: number;
  CULT?: number;
  DOGE?: number;
  ETH?: number;
  PUMP?: number;
  SKR?: number;
  SOL?: number;
  SOLUNA?: number;
  TON?: number;
  TROLL?: number;
  /** Silver (XAG) USD per troy oz via Kinesis Silver (KAG) */
  XAG?: number;
  /** Gold (XAU) spot USD per troy oz via PAX Gold (PAXG) */
  XAU?: number;
  XMR?: number;
}

// Fallback prices to return immediately if external APIs are slow (XAU = USD per troy oz)
const FALLBACK_PRICES: CryptoPricesResponse = {
  BNB: 600,
  BTC: 100000,
  CRUST: 0.0001,
  CULT: 0.0001,
  DOGE: 0.35,
  ETH: 3500,
  PUMP: 0.01,
  SKR: 0.01,
  SOL: 200,
  SOLUNA: 0.01,
  TON: 5.5,
  TROLL: 1,
  XAU: 2650,
  XMR: 150,
};

export async function GET() {
  const FETCH_TIMEOUT = 5000; // 5 second timeout for external APIs

  try {
    // Fetch via shared client (60s cache, 30/min rate limit). SKR from CoinGecko (not pump.fun).
    const [d, solanaTokenPrices] = await Promise.all([
      getCoinGeckoSimplePrice(COINGECKO_IDS),
      getCoinGeckoTokenPrice("solana", [PUMP_MINT_MAINNET, SKR_MINT_MAINNET]),
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
    if (d?.binancecoin?.usd) prices.BNB = d.binancecoin.usd;

    // PUMP: prefer CoinGecko token price (keys are often lowercase); fallback to pump.fun DEX if missing
    const pumpEntry =
      solanaTokenPrices?.[PUMP_MINT_MAINNET.toLowerCase()] ??
      solanaTokenPrices?.[PUMP_MINT_MAINNET];
    if (pumpEntry?.usd != null && pumpEntry.usd > 0) {
      prices.PUMP = pumpEntry.usd;
    }

    // SKR (Seeker): from CoinGecko by Solana contract (not a pump.fun token)
    const skrEntry =
      solanaTokenPrices?.[SKR_MINT_MAINNET.toLowerCase()] ??
      solanaTokenPrices?.[SKR_MINT_MAINNET];
    if (skrEntry?.usd != null && skrEntry.usd > 0) {
      prices.SKR = skrEntry.usd;
    }

    // CRUST via pump.fun LP (no CoinGecko listing); PUMP fallback from pump.fun when CoinGecko doesn't return it
    const solUsd = d?.solana?.usd;
    if (typeof solUsd === "number" && solUsd > 0) {
      try {
        const connection = new Connection(getSolanaRpcUrlServer());
        const [
          crustSolPerToken,
          cultSolPerToken,
          pumpSolPerToken,
          trollSolPerToken,
          solunaSolPerToken,
        ] = await Promise.all([
          Promise.race([
            getPumpTokenPriceInSol(
              connection,
              new PublicKey(CRUST_MINT_MAINNET),
            ),
            new Promise<number>((resolve) =>
              setTimeout(() => resolve(0), FETCH_TIMEOUT),
            ),
          ]),
          Promise.race([
            getPumpTokenPriceInSol(
              connection,
              new PublicKey(CULT_MINT_MAINNET),
            ),
            new Promise<number>((resolve) =>
              setTimeout(() => resolve(0), FETCH_TIMEOUT),
            ),
          ]),
          // Only fetch PUMP from pump.fun if CoinGecko didn't return it
          prices.PUMP != null && prices.PUMP > 0
            ? Promise.resolve(0)
            : Promise.race([
                getPumpTokenPriceInSol(
                  connection,
                  new PublicKey(PUMP_MINT_MAINNET),
                ),
                new Promise<number>((resolve) =>
                  setTimeout(() => resolve(0), FETCH_TIMEOUT),
                ),
              ]),
          Promise.race([
            getPumpTokenPriceInSol(
              connection,
              new PublicKey(TROLL_MINT_MAINNET),
            ),
            new Promise<number>((resolve) =>
              setTimeout(() => resolve(0), FETCH_TIMEOUT),
            ),
          ]),
          Promise.race([
            getPumpTokenPriceInSol(
              connection,
              new PublicKey(SOLUNA_MINT_MAINNET),
            ),
            new Promise<number>((resolve) =>
              setTimeout(() => resolve(0), FETCH_TIMEOUT),
            ),
          ]),
        ]);
        if (crustSolPerToken > 0) prices.CRUST = crustSolPerToken * solUsd;
        if (cultSolPerToken > 0) prices.CULT = cultSolPerToken * solUsd;
        if (pumpSolPerToken > 0 && (prices.PUMP == null || prices.PUMP <= 0)) {
          prices.PUMP = pumpSolPerToken * solUsd;
        }
        if (trollSolPerToken > 0) {
          prices.TROLL = trollSolPerToken * solUsd;
        }
        if (solunaSolPerToken > 0) {
          prices.SOLUNA = solunaSolPerToken * solUsd;
        }
      } catch {
        // pump.fun price fetch failed, continue with CoinGecko-only prices
      }
    }

    // TROLL fallback when pump.fun doesn't return a price
    if (prices.TROLL == null || prices.TROLL <= 0) {
      prices.TROLL = 1;
    }

    // SOLUNA fallback when pump.fun doesn't return a price
    if (prices.SOLUNA == null || prices.SOLUNA <= 0) {
      prices.SOLUNA = FALLBACK_PRICES.SOLUNA ?? 0.01;
    }

    // CULT fallback when pump.fun doesn't return a price
    if (prices.CULT == null || prices.CULT <= 0) {
      prices.CULT = FALLBACK_PRICES.CULT ?? 0.0001;
    }

    // SKR (Seeker) fallback when CoinGecko doesn't return a price
    if (prices.SKR == null || prices.SKR <= 0) {
      prices.SKR = FALLBACK_PRICES.SKR ?? 0.01;
    }

    // BNB fallback when CoinGecko doesn't return a price
    if (prices.BNB == null || prices.BNB <= 0) {
      prices.BNB = FALLBACK_PRICES.BNB ?? 600;
    }

    return NextResponse.json(prices);
  } catch {
    return NextResponse.json(FALLBACK_PRICES);
  }
}
