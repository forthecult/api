/**
 * True if the value looks like a real email address (e.g. user@domain.com),
 * not a crypto/wallet placeholder like solana_xxx@wallet.local or ethereum_xxx@wallet.local.
 */
export function isRealEmail(value: null | string | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Exclude known wallet placeholder patterns (e.g. from Solana/Ethereum auth plugins)
  if (trimmed.endsWith("@wallet.local")) return false;
  if (/^(solana_|ethereum_)[^@]+@/i.test(trimmed)) return false;
  // Basic email shape: local@domain.tld
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
