/**
 * CULT supply reader — authoritative on-chain totals for exchange trackers.
 *
 * Queries Solana mainnet directly (via NEXT_PUBLIC_SOLANA_RPC_URL or the
 * Ankr public endpoint baked into `getSolanaRpcUrlServer`) and returns the
 * fields CoinMarketCap and CoinGecko need: max, total, circulating, burned.
 *
 * Circulating = total − sum of balances held in addresses listed in
 * CULT_EXCLUDED_ADDRESSES (comma-separated SPL token account pubkeys).
 * With no env override circulating === total, which is the conservative
 * choice until the team formally documents treasury holdings.
 *
 * Serves stale cached values if the upstream RPC call fails, so CMC /
 * CoinGecko polls do not flap during a transient outage.
 */

import { CULT_MINT_MAINNET, getSolanaRpcUrlServer } from "~/lib/solana-pay";

/** Launch supply for CULT on Solana (pump.fun default). Overridable via env. */
const DEFAULT_MAX_SUPPLY = 1_000_000_000;

const CACHE_TTL_MS = 60_000;
const RPC_TIMEOUT_MS = 8_000;

export interface CultSupply {
  /** Tokens burned since launch (maxSupply − totalSupply). */
  burnedSupply: number;
  /** Circulating supply (total − excluded addresses). */
  circulatingSupply: number;
  /** SPL decimals (6 for CULT). */
  decimals: number;
  /** Addresses subtracted from circulating, in order. */
  excludedAddresses: string[];
  /** When this snapshot was read. */
  fetchedAt: number;
  /** Hard cap at launch (1,000,000,000 unless overridden). */
  maxSupply: number;
  /** SPL mint address on Solana mainnet. */
  mint: string;
  /** Network identifier, for response metadata. */
  network: "solana-mainnet";
  /** True if the snapshot was served from the in-memory cache after an RPC failure. */
  stale: boolean;
  /** Ticker. */
  symbol: "CULT";
  /** Current on-chain supply. Decreases as the buyback mechanism burns. */
  totalSupply: number;
}

let cached: null | { data: CultSupply; expiresAt: number } = null;

interface RpcContextResult<T> {
  context: { slot: number };
  value: T;
}

interface RpcEnvelope<T> {
  error?: { code?: number; message: string };
  result?: T;
}

interface TokenAmountValue {
  amount: string;
  decimals: number;
  uiAmount: null | number;
  uiAmountString?: string;
}

/**
 * Read CULT supply. Returns cached value within TTL; falls back to stale
 * cache if the RPC call fails. Only throws if there is no cache at all.
 */
export async function getCultSupply(): Promise<CultSupply> {
  const now = Date.now();
  if (cached && now < cached.expiresAt) return cached.data;

  try {
    const fresh = await fetchFresh();
    cached = { data: fresh, expiresAt: now + CACHE_TTL_MS };
    return fresh;
  } catch (err) {
    if (cached) {
      console.warn(
        "[cult-supply] rpc read failed, serving stale cache:",
        err instanceof Error ? err.message : err,
      );
      return { ...cached.data, stale: true };
    }
    throw err;
  }
}

async function fetchFresh(): Promise<CultSupply> {
  const total = await rpc<RpcContextResult<TokenAmountValue>>(
    "getTokenSupply",
    [CULT_MINT_MAINNET],
  );
  const decimals = total.value.decimals;
  const totalSupply = total.value.uiAmount ?? 0;
  const maxSupply = parseMaxSupply();
  const burnedSupply = Math.max(0, maxSupply - totalSupply);

  const excluded = parseExcludedAddresses();
  let excludedTotal = 0;
  for (const addr of excluded) {
    excludedTotal += await readExcludedBalance(addr);
  }
  const circulatingSupply = Math.max(0, totalSupply - excludedTotal);

  return {
    burnedSupply,
    circulatingSupply,
    decimals,
    excludedAddresses: excluded,
    fetchedAt: Date.now(),
    maxSupply,
    mint: CULT_MINT_MAINNET,
    network: "solana-mainnet",
    stale: false,
    symbol: "CULT",
    totalSupply,
  };
}

function parseExcludedAddresses(): string[] {
  const raw = process.env.CULT_EXCLUDED_ADDRESSES?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseMaxSupply(): number {
  const raw = process.env.CULT_MAX_SUPPLY?.trim();
  if (!raw) return DEFAULT_MAX_SUPPLY;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_SUPPLY;
}

async function readExcludedBalance(addr: string): Promise<number> {
  try {
    const bal = await rpc<RpcContextResult<TokenAmountValue>>(
      "getTokenAccountBalance",
      [addr],
    );
    return bal.value.uiAmount ?? 0;
  } catch {
    return 0;
  }
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(getSolanaRpcUrlServer(), {
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`solana rpc ${method} http ${res.status}`);
  }
  const json = (await res.json()) as RpcEnvelope<T>;
  if (json.error) {
    throw new Error(`solana rpc ${method}: ${json.error.message}`);
  }
  if (json.result === undefined) {
    throw new Error(`solana rpc ${method}: empty result`);
  }
  return json.result;
}
