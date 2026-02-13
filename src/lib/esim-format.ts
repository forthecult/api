/**
 * Normalize eSIM package display name: "30Day" → "30 Days", "1Day" → "1 Day".
 */
export function formatEsimPackageName(name: string): string {
  if (!name || typeof name !== "string") return name;
  return name.replace(/(\d+)Day\b/gi, (_, n) =>
    Number(n) === 1 ? "1 Day" : `${n} Days`,
  );
}
