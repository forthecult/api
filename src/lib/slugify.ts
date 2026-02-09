/**
 * Lowercase string and replace non-alphanumeric chars with hyphens for slugs/keys.
 * Trims leading/trailing hyphens and limits length.
 */
export function slugify(str: string, maxLength = 100): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength);
}
