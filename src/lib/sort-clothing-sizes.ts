/**
 * Standard order for clothing sizes (smallest to largest).
 * Used so Size options display as XS, S, M, L, XL, 2XL, 3XL, etc.
 */
const SIZE_ORDER = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "2X",
  "2XL",
  "3X",
  "3XL",
  "4X",
  "4XL",
  "5X",
  "5XL",
  "6X",
  "6XL",
] as const;

const SIZE_ORDER_INDEX = new Map<string, number>(
  SIZE_ORDER.map((s, i) => [s.toUpperCase(), i]),
);

/**
 * Compare two size strings for sorting (smallest first).
 * Letter sizes (XS, S, M, L, XL, 2XL, ...) use standard order.
 * Numeric sizes (e.g. 28, 30, 32 or 5, 5.5, 6) sort by number.
 * Unknown sizes sort after known ones, then alphabetically.
 */
function sizeRank(a: string): number {
  const upper = a.toUpperCase().trim();
  const known = SIZE_ORDER_INDEX.get(upper);
  if (known !== undefined) return known;
  const num = parseFloat(a.replace(/,/g, ".").trim());
  if (!Number.isNaN(num)) return 1000 + num;
  return 2000 + upper.charCodeAt(0);
}

/**
 * Sort an array of size strings from smallest to largest.
 * E.g. ["2XL", "S", "M", "XL", "XS"] → ["XS", "S", "M", "XL", "2XL"].
 */
export function sortClothingSizes(values: string[]): string[] {
  return [...values].sort((a, b) => sizeRank(a) - sizeRank(b));
}
