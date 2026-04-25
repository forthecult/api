/**
 * Normalize eSIM package display name: "30Day" → "30 Days", "1Day" → "1 Day".
 */
export function formatEsimPackageName(name: string): string {
  if (!name || typeof name !== "string") return name;
  return name.replace(/(\d+)Day\b/gi, (_, n) =>
    Number(n) === 1 ? "1 Day" : `${n} Days`,
  );
}

/**
 * For unlimited-style plans, get the base plan name (e.g. "Unlimited Data") by
 * stripping " For N Day(s) in ...". Returns null if the name doesn't match that pattern.
 */
export function getUnlimitedPlanBaseName(name: string): null | string {
  if (!name || typeof name !== "string") return null;
  const match = name.match(/^(.+?)\s+For\s+\d+\s*Days?\s+/i);
  return match ? match[1].trim() : null;
}

const VARIANT_REGEX = /(Throttled|Unthrottled|V2)/i;

/** Format validity for dropdown: "1 Day", "7 Days", etc. */
export function formatValidityOption(days: number): string {
  return days === 1 ? "1 Day" : `${days} Days`;
}

/**
 * Group key for unlimited plans so we don't merge different product lines.
 * Throttled vs Unthrottled (and V2) are always separate listings.
 * Returns null if the name doesn't match the unlimited pattern.
 */
export function getUnlimitedPlanGroupKey(name: string): null | string {
  if (!name || typeof name !== "string") return null;
  const match = name.match(/^(.+?)\s+For\s+\d+\s*Days?\s+(.+)$/is);
  if (!match) return null;
  const rawBase = match[1].trim();
  const rawSuffix = match[2].trim();
  const variant = getVariantFromName(name) ?? "default";
  const base = stripVariant(rawBase);
  const suffix = stripVariant(rawSuffix);
  return `${base || rawBase}|${suffix || rawSuffix}|${variant}`;
}

/** Extract first Throttled|Unthrottled|V2 from a string (case-preserved). Exported for UI labels. */
export function getVariantFromName(name: string): null | string {
  const m = name.match(VARIANT_REGEX);
  return m ? m[1]! : null;
}

/** Strip Throttled/Unthrottled/V2 from a string (and surrounding comma/space). */
function stripVariant(text: string): string {
  return text
    .replace(/,?\s*(Throttled|Unthrottled|V2)\s*,?/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/,?\s*$/, "");
}
