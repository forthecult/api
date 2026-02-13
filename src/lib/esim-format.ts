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
export function getUnlimitedPlanBaseName(name: string): string | null {
  if (!name || typeof name !== "string") return null;
  const match = name.match(/^(.+?)\s+For\s+\d+\s*Days?\s+/i);
  return match ? match[1].trim() : null;
}

/**
 * Group key for unlimited plans so we don't merge different product lines.
 * e.g. "Unlimited Data ... Throttled" and "Unlimited Data ... Unthrottled" are different.
 * Returns null if the name doesn't match the unlimited pattern.
 */
export function getUnlimitedPlanGroupKey(name: string): string | null {
  if (!name || typeof name !== "string") return null;
  const match = name.match(/^(.+?)\s+For\s+\d+\s*Days?\s+(.+)$/is);
  if (!match) return null;
  const base = match[1].trim();
  const suffix = match[2].trim(); // e.g. "in Korea, Throttled" or "in Korea, Unthrottled"
  return `${base}|${suffix}`;
}

/** Format validity for dropdown: "1 Day", "7 Days", etc. */
export function formatValidityOption(days: number): string {
  return days === 1 ? "1 Day" : `${days} Days`;
}
