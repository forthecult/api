/**
 * Public URLs for Culture AI marketing and checkout.
 * Set NEXT_PUBLIC_CULTURE_AI_PRODUCT_SLUG to your subscription product slug (see admin / DB).
 */

export function getCultureAiProductHref(): string {
  const slug = process.env.NEXT_PUBLIC_CULTURE_AI_PRODUCT_SLUG?.trim();
  if (slug) return `/products/${encodeURIComponent(slug)}`;
  return "/products";
}
