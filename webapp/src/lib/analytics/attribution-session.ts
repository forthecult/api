/**
 * Session-scoped acquisition parameters (UTM + click ids).
 * Stored in sessionStorage — no new persistent marketing cookies (see ADS-STRATEGY).
 */

export const ATTRIBUTION_SESSION_STORAGE_KEY = "cult.attribution_session_v1";

/** Stripe metadata values are limited to 500 characters. */
export const STRIPE_ATTRIBUTION_METADATA_MAX = 450;

export const ATTRIBUTION_PARAM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "tw_source",
  "tg_source",
] as const;

export type AttributionParamKey = (typeof ATTRIBUTION_PARAM_KEYS)[number];

export type AttributionSnapshot = Partial<Record<AttributionParamKey, string>>;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function readRaw(): AttributionSnapshot {
  if (!isBrowser()) return {};
  try {
    const raw = sessionStorage.getItem(ATTRIBUTION_SESSION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return parsed as AttributionSnapshot;
  } catch {
    return {};
  }
}

function writeRaw(next: AttributionSnapshot): void {
  if (!isBrowser()) return;
  try {
    const keys = Object.keys(next).filter((k) =>
      next[k as AttributionParamKey]?.trim(),
    );
    if (keys.length === 0) {
      sessionStorage.removeItem(ATTRIBUTION_SESSION_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(
      ATTRIBUTION_SESSION_STORAGE_KEY,
      JSON.stringify(next),
    );
  } catch {
    // private mode / quota
  }
}

/**
 * Merge allowed query keys from the current URL into session storage (first non-empty wins per key).
 */
export function mergeAttributionFromLocationSearch(
  search: string,
): AttributionSnapshot {
  if (!search) return readRaw();
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const prev = readRaw();
  const next: AttributionSnapshot = { ...prev };
  for (const key of ATTRIBUTION_PARAM_KEYS) {
    const v = params.get(key)?.trim();
    if (v && !next[key]) next[key] = v.slice(0, 256);
  }
  writeRaw(next);
  return next;
}

export function getAttributionSnapshot(): AttributionSnapshot {
  return readRaw();
}

/** Super-properties shape for PostHog `register` (same keys as UTMs). */
export function getAttributionSuperProperties(): Record<string, string> {
  const snap = readRaw();
  const out: Record<string, string> = {};
  for (const key of ATTRIBUTION_PARAM_KEYS) {
    const v = snap[key]?.trim();
    if (v) out[key] = v;
  }
  return out;
}

/** Flat props merged into funnel `capture` calls (client). */
export function getAttributionEventProps(): Record<string, string> {
  const snap = readRaw();
  const out: Record<string, string> = {};
  for (const key of ATTRIBUTION_PARAM_KEYS) {
    const v = snap[key]?.trim();
    if (v) out[key] = v;
  }
  return out;
}

/**
 * Compact JSON for Stripe Checkout `metadata.attribution` (truncated).
 */
export function getAttributionJsonForStripeMetadata(): null | string {
  const snap = readRaw();
  const trimmed: AttributionSnapshot = {};
  for (const key of ATTRIBUTION_PARAM_KEYS) {
    const v = snap[key]?.trim();
    if (v) trimmed[key] = v.slice(0, 120);
  }
  if (Object.keys(trimmed).length === 0) return null;
  const json = JSON.stringify(trimmed);
  if (json.length <= STRIPE_ATTRIBUTION_METADATA_MAX) return json;
  // Truncate whole JSON string (rare); platforms only need coarse attribution.
  return json.slice(0, STRIPE_ATTRIBUTION_METADATA_MAX);
}
