/**
 * Minimal E.164 helpers for profile/checkout phone (no full libphonenumber dependency).
 */

const ISO_TO_DIAL: Record<string, string> = {
  AE: "971",
  AR: "54",
  AT: "43",
  AU: "61",
  BE: "32",
  BR: "55",
  BZ: "501",
  CA: "1",
  CH: "41",
  CL: "56",
  CR: "506",
  DE: "49",
  DK: "45",
  EE: "372",
  ES: "34",
  FI: "358",
  FJ: "679",
  FR: "33",
  GB: "44",
  HK: "852",
  IE: "353",
  IL: "972",
  IN: "91",
  IS: "354",
  IT: "39",
  JP: "81",
  KN: "1869",
  KR: "82",
  LI: "423",
  LT: "370",
  LU: "352",
  ME: "382",
  MX: "52",
  NL: "31",
  NO: "47",
  NZ: "64",
  PA: "507",
  PH: "63",
  PL: "48",
  PT: "351",
  QA: "974",
  SA: "966",
  SE: "46",
  SG: "65",
  SV: "503",
  TW: "886",
  US: "1",
};

const DIAL_SORTED: { dial: string; iso: string }[] = (() => {
  const out: { dial: string; iso: string }[] = [];
  for (const [iso, dial] of Object.entries(ISO_TO_DIAL)) {
    out.push({ dial, iso });
  }
  return out.sort((a, b) => b.dial.length - a.dial.length);
})();

/**
 * Strips to digits; builds E.164: +<dial><national>
 */
export function combineToE164(
  iso: string,
  nationalDigits: string,
): null | string {
  const d = getDialCodeForIso(iso);
  const n = nationalDigits.replace(/\D/g, "");
  if (n.length < 4) return null;
  return `+${d}${n}`;
}

export function getDialCodeForIso(iso: null | string | undefined): string {
  if (!iso) return "1";
  return ISO_TO_DIAL[iso.toUpperCase()] ?? "1";
}

export function parseE164ToForm(e164: null | string | undefined): {
  iso: string;
  national: string;
} {
  if (!e164 || typeof e164 !== "string" || !e164.startsWith("+")) {
    return { iso: "US", national: (e164 ?? "").replace(/\D/g, "") };
  }
  const rest = e164.slice(1).replace(/\D/g, "");
  for (const { dial, iso } of DIAL_SORTED) {
    if (rest.startsWith(dial)) {
      return { iso, national: rest.slice(dial.length) };
    }
  }
  return { iso: "US", national: rest };
}
