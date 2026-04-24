import { resolveUsStateCodeFromGeo } from "~/lib/geo-us-state";

/** Normalize keys like "Québec" → "QUEBEC" for map lookup. */
function normKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Canadian provinces & territories: English / French names → postal abbreviation. */
const CA_NAME_TO_CODE = new Map<string, string>([
  ["ALBERTA", "AB"],
  ["BRITISH COLUMBIA", "BC"],
  ["MANITOBA", "MB"],
  ["NEW BRUNSWICK", "NB"],
  ["NEWFOUNDLAND AND LABRADOR", "NL"],
  ["NOVA SCOTIA", "NS"],
  ["NORTHWEST TERRITORIES", "NT"],
  ["NUNAVUT", "NU"],
  ["ONTARIO", "ON"],
  ["PRINCE EDWARD ISLAND", "PE"],
  ["QUEBEC", "QC"],
  ["SASKATCHEWAN", "SK"],
  ["YUKON", "YT"],
]);

/** Australian states & territories → common abbreviation used in addresses. */
const AU_NAME_TO_CODE = new Map<string, string>([
  ["AUSTRALIAN CAPITAL TERRITORY", "ACT"],
  ["NEW SOUTH WALES", "NSW"],
  ["NORTHERN TERRITORY", "NT"],
  ["QUEENSLAND", "QLD"],
  ["SOUTH AUSTRALIA", "SA"],
  ["TASMANIA", "TAS"],
  ["VICTORIA", "VIC"],
  ["WESTERN AUSTRALIA", "WA"],
]);

const CA_CODES = new Set([
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
]);
const AU_CODES = new Set(["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]);

function resolveCanada(
  region: null | string | undefined,
  regionName: null | string | undefined,
): null | string {
  const tryCode = (s: string) => {
    const u = s.trim().toUpperCase();
    if (u.length === 2 && CA_CODES.has(u)) return u;
    return null;
  };
  const r = region?.trim();
  if (r) {
    const asCode = tryCode(r);
    if (asCode) return asCode;
    const fromHyphen = /^CA-?([A-Z]{2})$/i.exec(r);
    if (fromHyphen?.[1] && CA_CODES.has(fromHyphen[1].toUpperCase())) {
      return fromHyphen[1].toUpperCase();
    }
  }
  if (regionName?.trim()) {
    const key = normKey(regionName);
    const fromName = CA_NAME_TO_CODE.get(key);
    if (fromName) return fromName;
  }
  if (r) return r;
  if (regionName?.trim()) return regionName.trim();
  return null;
}

function resolveAustralia(
  region: null | string | undefined,
  regionName: null | string | undefined,
): null | string {
  const tryCode = (s: string) => {
    const u = s.trim().toUpperCase();
    if (AU_CODES.has(u)) return u;
    return null;
  };
  const r = region?.trim();
  if (r) {
    const asCode = tryCode(r);
    if (asCode) return asCode;
    const fromHyphen = /^AU-?([A-Z]{2,3})$/i.exec(r);
    if (fromHyphen?.[1]) {
      const c = fromHyphen[1].toUpperCase();
      if (AU_CODES.has(c)) return c;
    }
  }
  if (regionName?.trim()) {
    const key = normKey(regionName);
    const fromName = AU_NAME_TO_CODE.get(key);
    if (fromName) return fromName;
  }
  if (r) return r;
  if (regionName?.trim()) return regionName.trim();
  return null;
}

function resolveGeneric(
  region: null | string | undefined,
  regionName: null | string | undefined,
): null | string {
  const r = region?.trim();
  if (r) return r.length > 120 ? r.slice(0, 120) : r;
  const n = regionName?.trim();
  if (n) return n.length > 120 ? n.slice(0, 120) : n;
  return null;
}

/**
 * Best value for checkout / estimate `state` / `stateCode` from IP geo
 * (`region` is often a subdivision code; `regionName` is the long name).
 * Supports US (strict ISO-3166-2 codes), CA, AU, and a safe fallback for any
 * other ISO-3166-1 alpha-2 country.
 */
export function resolveGeoRegionForCheckout(
  countryIso2: string,
  region: null | string | undefined,
  regionName: null | string | undefined,
): null | string {
  const c = countryIso2.trim().toUpperCase().slice(0, 2);
  if (c.length !== 2) return null;

  if (c === "US") {
    return resolveUsStateCodeFromGeo(region, regionName);
  }
  if (c === "CA") {
    return resolveCanada(region, regionName);
  }
  if (c === "AU") {
    return resolveAustralia(region, regionName);
  }
  // BR, IN, MX and worldwide: ip-api usually returns a usable `region` code;
  // otherwise prefer the human-readable subdivision name.
  return resolveGeneric(region, regionName);
}
