import { getPublicSiteUrl } from "~/lib/app-url";

/**
 * Builds `alternates.languages` entries for Next.js metadata (absolute URLs).
 * Until locale-prefixed routes exist (`NEXT_PUBLIC_LOCALE_PREFIX=1`), every
 * locale maps to the same URL so crawlers never hit missing `/es/...` paths.
 */
export function buildHreflangLanguages(pathWithLeadingSlash: string): {
  [locale: string]: string;
} {
  const base = getPublicSiteUrl().replace(/\/$/, "");
  const path = pathWithLeadingSlash.startsWith("/")
    ? pathWithLeadingSlash
    : `/${pathWithLeadingSlash}`;
  const canonical = `${base}${path}`;

  const raw = process.env.NEXT_PUBLIC_LOCALES?.trim() || "en";
  const locales = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const usePrefix = process.env.NEXT_PUBLIC_LOCALE_PREFIX === "1";

  const out: Record<string, string> = {};

  if (!usePrefix || locales.length <= 1) {
    out["x-default"] = canonical;
    out.en = canonical;
    for (const loc of locales) {
      if (loc !== "en") out[loc] = canonical;
    }
    return out;
  }

  for (const loc of locales) {
    const prefix = loc === "en" ? "" : `/${loc}`;
    out[loc] = `${base}${prefix}${path}`;
  }
  out["x-default"] = `${base}${path}`;
  return out;
}
