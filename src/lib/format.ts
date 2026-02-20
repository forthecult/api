/**
 * Shared formatting helpers. Use these instead of duplicating Intl logic.
 */

/** e.g. "Feb 4, 2026" */
export function formatDateShort(date: Date | number | string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(typeof date === "object" ? date : new Date(date));
}

/** e.g. "Feb 4, 2026" — convenience alias for formatDateShort */
export const formatDate = formatDateShort;

/** Format cents as USD e.g. "$12.34" */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

/** e.g. "February 4, 2026" */
export function formatDateLong(date: Date | number | string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(typeof date === "object" ? date : new Date(date));
}

/** e.g. "Feb 4, 2026, 3:45 PM" */
export function formatDateTime(date: Date | number | string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(typeof date === "object" ? date : new Date(date));
  } catch {
    return "—";
  }
}

/** Compact market cap: $1.5M, $2.3k */
export function formatMarketCap(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

/** Raw token amount with decimals (e.g. voting power): 1.5M, 2.3K, 1.00 */
export function formatPower(raw: number, decimals = 6): string {
  const human = raw / 10 ** decimals;
  if (human >= 1e6) return (human / 1e6).toFixed(2) + "M";
  if (human >= 1e3) return (human / 1e3).toFixed(2) + "K";
  return human.toFixed(2);
}

/** Compact token amount: 1.5M, 2.3K, 0.001, 0 */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n).toLocaleString()}`;
  if (n >= 1) return n.toFixed(1);
  if (n > 0) return n.toFixed(4);
  return "0";
}

/** Full token amount with thousand separators: 1,234,567 */
export function formatTokensPrecise(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  return Math.round(n).toLocaleString("en-US");
}

/** USD with sensible precision: $1.23, $0.01, $0.000001 */
export function formatUsd(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(2)}`;
  if (n > 0) return `$${n.toFixed(6)}`;
  return "$0.00";
}
