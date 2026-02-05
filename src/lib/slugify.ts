/**
 * Lowercase string and replace spaces/special chars with hyphens for slugs/keys.
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
}
