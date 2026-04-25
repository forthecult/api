/**
 * TON (The Open Network) payment helpers for checkout.
 * See https://docs.ton.org/payments/overview
 *
 * - Single merchant wallet; orderId is used as transfer comment for matching.
 * - Amount in TON (1 TON = 10^9 nanotons).
 */

const TON_DECIMALS = 9;
const NANOTONS_PER_TON = 10 ** TON_DECIMALS;

/**
 * Build TON transfer deep link: ton://transfer/<address>?amount=<nanotons>&text=<comment>
 * See https://docs.ton.org/develop/dapps/asset-processing/ton-payments
 */
export function buildTonTransferUrl(params: {
  address: string;
  amountTon: string;
  comment?: string;
}): string {
  const nanotons = tonToNanotons(params.amountTon);
  const u = new URL(`ton://transfer/${params.address}`);
  u.searchParams.set("amount", nanotons);
  if (params.comment?.trim()) {
    u.searchParams.set("text", params.comment.trim());
  }
  return u.toString();
}

/** TON wallet address for receiving payments (env: TON_WALLET_ADDRESS). */
export function getTonWalletAddress(): string | undefined {
  const addr = process.env.TON_WALLET_ADDRESS?.trim();
  return addr && addr.length > 0 ? addr : undefined;
}

/** Whether TON payments are configured. */
export function isTonPayConfigured(): boolean {
  return Boolean(getTonWalletAddress());
}

/**
 * Convert TON amount (string) to nanotons (bigint string for ton:// link).
 */
export function tonToNanotons(tonAmount: string): string {
  const num = Number.parseFloat(tonAmount);
  if (!Number.isFinite(num) || num < 0) return "0";
  const nanotons = Math.floor(num * NANOTONS_PER_TON);
  return String(nanotons);
}

/**
 * Convert USD cents to TON amount (string for precision).
 * Uses rate from argument (fetched from CoinGecko toncoin price).
 */
export function usdCentsToTonAmount(
  totalCents: number,
  tonUsdRate: number,
): string {
  if (tonUsdRate <= 0) return "0";
  const usd = totalCents / 100;
  const ton = usd / tonUsdRate;
  return ton.toFixed(6);
}
