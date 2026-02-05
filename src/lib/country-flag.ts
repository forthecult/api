/**
 * Convert a country code to a flag emoji.
 * Uses regional indicator symbols (Unicode).
 *
 * @example countryFlag("US") // "🇺🇸"
 * @example countryFlag("GB") // "🇬🇧"
 */
export function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join("");
}
