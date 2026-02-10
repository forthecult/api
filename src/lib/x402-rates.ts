/**
 * Server-side helpers for x402 paid data APIs: rates and bulk product data.
 * Uses existing CoinGecko cache and DB; fiat/fiat can be extended with a provider.
 */

import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "~/db";
import {
  productImagesTable,
  productsTable,
} from "~/db/schema";
import { getCoinGeckoSimplePrice } from "~/lib/coingecko";

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

const COINGECKO_TO_SYMBOL: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
  dogecoin: "DOGE",
  toncoin: "TON",
  monero: "XMR",
  "pax-gold": "XAU",
  "kinesis-silver": "XAG",
};

/** Fetch crypto and metal spot prices in USD (cached via CoinGecko). */
export async function getCryptoAndMetalPricesUsd(): Promise<
  Record<string, number>
> {
  const data = await getCoinGeckoSimplePrice(COINGECKO_IDS);
  const out: Record<string, number> = {};
  if (data) {
    for (const [id, val] of Object.entries(data)) {
      const symbol = COINGECKO_TO_SYMBOL[id];
      if (symbol && typeof val?.usd === "number") out[symbol] = val.usd;
    }
  }
  return out;
}

/** Fiat-to-fiat: optional provider. Frankfurter (free, no key) for EUR, USD, GBP, etc. */
const FiatCodes = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD"] as const;
export type FiatCode = (typeof FiatCodes)[number];

export async function getFiatRate(
  from: string,
  to: string,
): Promise<number | null> {
  const fromUpper = from.toUpperCase().trim();
  const toUpper = to.toUpperCase().trim();
  if (fromUpper === toUpper) return 1;

  if (!FiatCodes.includes(fromUpper as FiatCode) || !FiatCodes.includes(toUpper as FiatCode)) {
    return null;
  }

  try {
    const url = `https://api.frankfurter.app/latest?from=${fromUpper}&to=${toUpper}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as { rates?: Record<string, number> };
    const rate = data?.rates?.[toUpper];
    return typeof rate === "number" ? rate : null;
  } catch {
    return null;
  }
}

/** Bulk product id -> { usd, imageUrl, imageUrls[] }. Only published products. */
export async function getBulkProductPricesAndImages(
  productIds: string[],
): Promise<
  Array<{
    productId: string;
    usd: number;
    imageUrl: string | null;
    imageUrls: string[];
  }>
> {
  if (productIds.length === 0) return [];
  const uniq = [...new Set(productIds)].slice(0, 200);

  const [products, images] = await Promise.all([
    db
      .select({
        id: productsTable.id,
        priceCents: productsTable.priceCents,
        imageUrl: productsTable.imageUrl,
      })
      .from(productsTable)
      .where(
        and(inArray(productsTable.id, uniq), eq(productsTable.published, true)),
      ),
    db
      .select({
        productId: productImagesTable.productId,
        url: productImagesTable.url,
      })
      .from(productImagesTable)
      .where(inArray(productImagesTable.productId, uniq))
      .orderBy(asc(productImagesTable.sortOrder), asc(productImagesTable.id)),
  ]);

  const published = products.filter((p) => p.id);
  const priceMap = new Map(
    published.map((p) => [
      p.id,
      {
        productId: p.id,
        usd: (p.priceCents ?? 0) / 100,
        imageUrl: p.imageUrl ?? null,
        imageUrls: [] as string[],
      },
    ]),
  );

  for (const row of images) {
    const entry = priceMap.get(row.productId);
    if (entry) entry.imageUrls.push(row.url);
  }

  return uniq
    .map((id) => priceMap.get(id))
    .filter(Boolean) as Array<{
    productId: string;
    usd: number;
    imageUrl: string | null;
    imageUrls: string[];
  }>;
}
