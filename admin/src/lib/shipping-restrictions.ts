/**
 * No-ship countries: we do not ship to these (all products).
 * Keep in sync with ftc/src/lib/shipping-restrictions.ts.
 * Aligned with Printful/Printify: RU, BY, UA, EC, CU, IR, KP, SY, PS (Gaza). Used in admin Markets.
 */
export const EXCLUDED_SHIPPING_COUNTRY_CODES = [
  "SY",
  "KP",
  "CU",
  "RU",
  "BY",
  "UA",
  "EC",
  "IR",
  "PS",
  "VE",
  "NG",
  "LY",
  "ZW",
  "PK",
  "BD",
  "GH",
  "ID",
  "PH",
  "ET",
  "CM",
  "CI",
  "SN",
  "UG",
  "DZ",
  "LB",
  "SB",
  "WS",
  "TO",
  "VU",
  "FJ",
  "PG",
  "HT",
  "GY",
  "SR",
  "PY",
  "BO",
] as const;

export const EXCLUDED_SHIPPING_COUNTRIES = new Set<string>(
  EXCLUDED_SHIPPING_COUNTRY_CODES,
);

export function isShippingExcluded(code: string): boolean {
  const c = code?.trim().toUpperCase().slice(0, 2);
  return c.length === 2 && EXCLUDED_SHIPPING_COUNTRIES.has(c);
}
