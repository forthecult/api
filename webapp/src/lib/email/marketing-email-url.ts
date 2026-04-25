export function appendEmailUtm(
  absoluteUrl: string,
  campaign: string,
  content: string,
): string {
  try {
    const u = new URL(absoluteUrl);
    if (u.pathname.startsWith("/api/")) return absoluteUrl;
    const q = u.search;
    if (/[?&]token=/i.test(q) || /[?&]signature=/i.test(q)) return absoluteUrl;
    u.searchParams.set("utm_source", "email");
    u.searchParams.set("utm_medium", "email");
    u.searchParams.set("utm_campaign", campaign.slice(0, 120));
    u.searchParams.set("utm_content", content.slice(0, 120));
    return u.toString();
  } catch {
    return absoluteUrl;
  }
}

/**
 * Append standard UTM query params for email attribution (newsletters, drips, promos).
 * Skips URLs that are likely signed or API routes so tokens stay intact.
 */
/** Raw query fragment (no leading `?`) for manual link building in templates. */
export function emailUtmQueryString(campaign: string, content: string): string {
  return [
    "utm_source=email",
    "utm_medium=email",
    `utm_campaign=${encodeURIComponent(campaign.slice(0, 120))}`,
    `utm_content=${encodeURIComponent(content.slice(0, 120))}`,
  ].join("&");
}
