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
 * Used to group multiple validity options into one card with a days dropdown.
 */
export function getUnlimitedPlanBaseName(name: string): string | null {
  if (!name || typeof name !== "string") return null;
  const match = name.match(/^(.+?)\s+For\s+\d+\s*Days?\s+/i);
  return match ? match[1].trim() : null;
}

/** Format validity for dropdown: "1 Day", "7 Days", etc. */
export function formatValidityOption(days: number): string {
  return days === 1 ? "1 Day" : `${days} Days`;
}
