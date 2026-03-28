/**
 * Partner / referral URLs for /services. Set NEXT_PUBLIC_REFERRAL_* to override defaults.
 */

const DEFAULTS = {
  fixedfloat: "https://fixedfloat.com/",
  hyperliquid: "https://app.hyperliquid.xyz/",
  sideshift: "https://sideshift.ai/",
  trezor: "https://trezor.io/",
  uniswap: "https://app.uniswap.org/",
  venice: "https://venice.ai/",
} as const;

export type PartnerKey = keyof typeof DEFAULTS;

export function getPartnerUrl(key: PartnerKey): string {
  const envKey = `NEXT_PUBLIC_REFERRAL_${key.toUpperCase()}_URL` as const;
  const fromEnv = process.env[envKey];
  if (typeof fromEnv === "string" && fromEnv.length > 0) {
    return fromEnv;
  }
  return DEFAULTS[key];
}
