/**
 * PII redaction for analytics payloads.
 *
 * SOC 2 mapping: CC6.7 (restrict transmission, movement, and removal of
 * information to authorized internal or external users). Also helps with
 * GDPR Art. 5(1)(c) data minimisation.
 *
 * Rules:
 *   1. Any property whose key matches PII_KEY_DENYLIST is dropped.
 *   2. Any string value that looks like an email, phone number, credit card,
 *      or crypto wallet address is replaced with a redacted placeholder.
 *   3. The redactor is pure and safe to run on both client and server.
 *
 * Used by:
 *   - `instrumentation-client.ts` (PostHog browser init — `sanitize_properties`
 *     + `property_blacklist`).
 *   - `analytics/posthog-server.ts` (server-side `capture*`).
 *   - `lib/admin-audit.ts` (admin audit → PostHog mirror).
 */

/** Property keys that should never leave the device or reach analytics. */
export const PII_KEY_DENYLIST: ReadonlySet<string> = new Set([
  "address",
  "address1",
  "address2",
  "addressLine1",
  "addressLine2",
  "apartment",
  "authorization",
  "billing_address",
  "card_cvc",
  "card_expiry",
  "card_number",
  "city",
  "cookie",
  "country",
  "credit_card",
  "csrf",
  "cvc",
  "cvv",
  "date_of_birth",
  "dob",
  "email",
  "email_address",
  "first_name",
  "full_name",
  "given_name",
  "iban",
  "id_token",
  "last_name",
  "mobile",
  "name",
  "password",
  "passwd",
  "phone",
  "phone_number",
  "pin",
  "postal",
  "postal_code",
  "private_key",
  "routing_number",
  "seed_phrase",
  "secret",
  "session",
  "set-cookie",
  "ssn",
  "state",
  "street",
  "surname",
  "tax_id",
  "token",
  "x-api-key",
  "zip",
  "zipcode",
]);

/** Regex-based value redactors (applied to all string leaves). */
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;
const CREDIT_CARD_RE = /\b(?:\d[ -]*?){13,19}\b/g;
// Solana (base58, 32-44 chars) and ETH (0x + 40 hex).
const CRYPTO_ADDR_RE =
  /\b(?:0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})\b/g;

function redactString(s: string): string {
  return s
    .replace(EMAIL_RE, "[redacted:email]")
    .replace(CREDIT_CARD_RE, "[redacted:ccn]")
    .replace(PHONE_RE, "[redacted:phone]")
    .replace(CRYPTO_ADDR_RE, "[redacted:wallet]");
}

function normaliseKey(k: string): string {
  return k.toLowerCase().replace(/[_-]/g, "");
}

const NORMALISED_DENY: ReadonlySet<string> = new Set(
  [...PII_KEY_DENYLIST].map(normaliseKey),
);

export function isPiiKey(key: string): boolean {
  return NORMALISED_DENY.has(normaliseKey(key));
}

export function redactValue(v: unknown): unknown {
  if (v == null) return v;
  if (typeof v === "string") return redactString(v);
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.map(redactValue);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (isPiiKey(k)) {
        out[k] = "[redacted]";
        continue;
      }
      out[k] = redactValue(val);
    }
    return out;
  }
  return v;
}

/**
 * Scrub a properties object in place (or return a new one). Drops any key
 * whose name is in the denylist and runs regex-based redaction on every
 * remaining string leaf.
 */
export function redactProperties(
  properties: null | Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!properties) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(properties)) {
    if (isPiiKey(k)) continue;
    out[k] = redactValue(v);
  }
  return out;
}
