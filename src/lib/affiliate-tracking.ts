/**
 * Affiliate referral code tracking.
 * Cookie is set when visitor lands with ?ref=CODE (middleware).
 * 90-day attribution window.
 */

export const AFFILIATE_COOKIE_NAME = "affiliate_code";
export const AFFILIATE_COOKIE_MAX_AGE_DAYS = 90;
export const AFFILIATE_COOKIE_MAX_AGE_SECONDS =
  AFFILIATE_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;

/**
 * Get the affiliate code from the cookie (client-side only).
 * Use in checkout to prefill or send with order.
 */
export function getAffiliateCodeFromDocument(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${AFFILIATE_COOKIE_NAME}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}
