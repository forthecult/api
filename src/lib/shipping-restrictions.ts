/**
 * Permanent shipping exclusions: we do not ship to these countries (all products).
 * ISO 3166-1 alpha-2 codes (uppercase).
 * Aligned with Printful/Printify no-ship list: Russia, Belarus, Ukraine (incl. Crimea, Luhansk, Donetsk),
 * Ecuador, Cuba, Iran, North Korea, Syria, Gaza Strip (PS). Plus additional policy exclusions below.
 */
export const EXCLUDED_SHIPPING_COUNTRY_CODES = [
  // Printful/Printify no-ship (keep in sync with their shipping policy)
  "SY", // Syria
  "KP", // North Korea
  "CU", // Cuba
  "RU", // Russia
  "BY", // Belarus
  "UA", // Ukraine (incl. Crimea, Luhansk, Donetsk)
  "EC", // Ecuador
  "IR", // Iran
  "PS", // Palestine (Gaza Strip)
  // Additional policy exclusions
  "VE", // Venezuela
  "NG", // Nigeria
  "LY", // Libya
  "ZW", // Zimbabwe
  "PK", // Pakistan
  "BD", // Bangladesh
  "GH", // Ghana
  "ID", // Indonesia
  "PH", // Philippines
  "ET", // Ethiopia
  "CM", // Cameroon
  "CI", // Ivory Coast
  "SN", // Senegal
  "UG", // Uganda
  "DZ", // Algeria
  "LB", // Lebanon
  "SB", // Solomon Islands
  "WS", // Samoa
  "TO", // Tonga
  "VU", // Vanuatu
  "FJ", // Fiji
  "PG", // Papua New Guinea
  "HT", // Haiti
  "GY", // Guyana
  "SR", // Suriname
  "PY", // Paraguay
  "BO", // Bolivia
] as const;

export const EXCLUDED_SHIPPING_COUNTRIES = new Set<string>(
  EXCLUDED_SHIPPING_COUNTRY_CODES.map((c) => c),
);

/**
 * Returns true if we do not ship to this country (all products).
 */
export function isShippingExcluded(countryCode: string): boolean {
  const code = countryCode?.trim().toUpperCase().slice(0, 2);
  return code.length === 2 && EXCLUDED_SHIPPING_COUNTRIES.has(code);
}
