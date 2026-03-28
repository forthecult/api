/**
 * Partner / referral URLs for /services. Set NEXT_PUBLIC_REFERRAL_* to override defaults.
 */

const DEFAULTS = {
  cloaked: "https://cloaked.com/",
  hyperliquid: "https://app.hyperliquid.xyz/",
  justdeleteme: "https://justdeleteme.xyz/",
  sideshift: "https://sideshift.ai/",
  trezor: "https://trezor.io/",
  uniswap: "https://app.uniswap.org/",
  venice: "https://venice.ai/",
} as const;

export type PartnerKey = keyof typeof DEFAULTS;

export const SERVICE_BRAND_LOGOS = {
  cloaked: "/services/brands/cloaked.svg",
  hyperliquid: "/services/brands/hyperliquid.svg",
  justdeleteme: "/services/brands/justdeleteme.png",
  sideshift: "/services/brands/sideshift.png",
  trezor: "/services/brands/trezor.svg",
  uniswap: "/services/brands/uniswap.svg",
  venice: "/services/brands/venice.svg",
} as const satisfies Record<PartnerKey, string>;

export function getPartnerUrl(key: PartnerKey): string {
  const envKey = `NEXT_PUBLIC_REFERRAL_${key.toUpperCase()}_URL` as const;
  const fromEnv = process.env[envKey];
  if (typeof fromEnv === "string" && fromEnv.length > 0) {
    return fromEnv;
  }
  return DEFAULTS[key];
}
