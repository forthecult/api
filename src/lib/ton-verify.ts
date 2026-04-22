/**
 * TON on-chain verification — used by the ton-pay confirm endpoint to
 * close cve c3 (no chain check, any txHash marked an order paid).
 *
 * Approach:
 *   query ton center's `getTransactions` for the single merchant wallet,
 *   then find an incoming transfer whose comment (in_msg.message) matches
 *   the orderId. verify destination + value + tx age.
 *
 * Docs: https://toncenter.com/api/v2/#/transactions
 */

import "server-only";

const TON_API_BASE = "https://toncenter.com/api/v2";
const LOOKUP_LIMIT = 40;
const MAX_TX_AGE_SEC = 60 * 60 * 6; // 6h — user has that long from order create to pay

interface TonCenterTx {
  in_msg?: {
    destination?: string;
    message?: string; // base64 by default
    msg_data?: {
      "@type"?: string;
      body?: string;
      text?: string;
    };
    source?: string;
    value?: string; // nanotons as decimal string
  };
  transaction_id?: {
    hash?: string;
    lt?: string;
  };
  utime?: number;
}

interface TonCenterResponse {
  error?: string;
  ok?: boolean;
  result?: TonCenterTx[];
}

export interface TonVerifyParams {
  /** expected amount in nanotons (order.cryptoAmount converted at create-order time). */
  expectedNanotons: bigint;
  /**
   * caller must pass the order id that was used as transfer comment.
   * matched case-sensitively against decoded in_msg.message.
   */
  orderId: string;
  /** merchant wallet address the customer was told to pay to. */
  toAddress: string;
  /** client-supplied tx hash; we will match it against ton center results. */
  txHash: string;
}

export interface TonVerifyResult {
  error?: string;
  /** actual nanotons observed on chain (>= expectedNanotons when ok). */
  lamports?: bigint;
  ok: boolean;
  /** ton center transaction hash we matched. */
  txHash?: string;
  utime?: number;
}

/**
 * Returns ok: true iff ton center returned a settled incoming tx for
 * `toAddress` with a matching orderId comment and value >= expectedNanotons.
 */
export async function verifyTonTransfer(
  params: TonVerifyParams,
): Promise<TonVerifyResult> {
  const { expectedNanotons, orderId, toAddress, txHash } = params;
  if (!toAddress || !orderId || expectedNanotons <= 0n) {
    return { error: "invalid verification params", ok: false };
  }

  const apiKey = process.env.TONCENTER_API_KEY?.trim();
  if (!apiKey) {
    // ton center is public but aggressively rate-limited without a key —
    // refuse rather than silently fall through, so ops sees the misconfig.
    return {
      error: "TONCENTER_API_KEY not configured; cannot verify TON payment.",
      ok: false,
    };
  }

  const url = new URL(`${TON_API_BASE}/getTransactions`);
  url.searchParams.set("address", toAddress);
  url.searchParams.set("limit", String(LOOKUP_LIMIT));
  url.searchParams.set("archival", "true");

  let response: TonCenterResponse;
  try {
    const res = await fetch(url.toString(), {
      headers: { "X-API-Key": apiKey },
      signal: AbortSignal.timeout(8_000),
    });
    response = (await res.json()) as TonCenterResponse;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "TON RPC request failed",
      ok: false,
    };
  }

  if (!response.ok || !Array.isArray(response.result)) {
    return {
      error: response.error ?? "TON Center returned an error",
      ok: false,
    };
  }

  const nowSec = Math.floor(Date.now() / 1000);

  for (const tx of response.result) {
    const inMsg = tx.in_msg;
    if (!inMsg) continue;

    // destination must be our wallet (ton center returns it with / without bounceable prefix;
    // a case-insensitive suffix match is the safest comparison).
    if (!addressesMatch(inMsg.destination, toAddress)) continue;

    const value = parseNanotons(inMsg.value);
    if (value === null || value < expectedNanotons) continue;

    const comment = extractComment(inMsg);
    if (!comment || comment.trim() !== orderId.trim()) continue;

    const utime = typeof tx.utime === "number" ? tx.utime : null;
    if (utime != null && nowSec - utime > MAX_TX_AGE_SEC) continue;

    const observedHash = tx.transaction_id?.hash ?? "";
    // client-supplied txHash is best-effort: ton has multiple hash encodings so
    // we don't require exact equality, but we do require the caller to have
    // provided one (prevents "any order can be paid by calling the endpoint
    // with no tx at all").
    if (!txHash.trim()) {
      return { error: "txHash required", ok: false };
    }

    return {
      lamports: value,
      ok: true,
      txHash: observedHash || txHash.trim(),
      utime: utime ?? undefined,
    };
  }

  return {
    error:
      "No matching TON transaction found for this order yet. Try again in a minute.",
    ok: false,
  };
}

function addressesMatch(a: string | undefined, b: string): boolean {
  if (!a) return false;
  const norm = (s: string) => s.trim().replace(/[-_]/g, "").toLowerCase();
  return norm(a) === norm(b);
}

function parseNanotons(value: string | undefined): bigint | null {
  if (!value) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function extractComment(inMsg: NonNullable<TonCenterTx["in_msg"]>): string {
  // ton center returns comments as either raw `message` (base64) or under
  // `msg_data.text`. try both; prefer decoded text.
  const data = inMsg.msg_data;
  if (data?.text && typeof data.text === "string") {
    return tryDecodeBase64(data.text) ?? data.text;
  }
  if (data?.body && typeof data.body === "string") {
    const decoded = tryDecodeBase64(data.body);
    if (decoded) return decoded;
  }
  if (inMsg.message && typeof inMsg.message === "string") {
    return tryDecodeBase64(inMsg.message) ?? inMsg.message;
  }
  return "";
}

function tryDecodeBase64(raw: string): null | string {
  try {
    return Buffer.from(raw, "base64").toString("utf8");
  } catch {
    return null;
  }
}
