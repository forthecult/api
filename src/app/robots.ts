import type { MetadataRoute } from "next";

import { getPublicSiteUrl } from "~/lib/app-url";

const siteUrl = getPublicSiteUrl();

/** Staging: Vercel preview deploys or explicit STAGING=1 (e.g. Railway). Production allows crawlers. */
const isStaging =
  process.env.VERCEL_ENV === "preview" || process.env.STAGING === "1";

export default function robots(): MetadataRoute.Robots {
  if (isStaging) {
    return {
      rules: [{ userAgent: "*", disallow: ["/"] }],
    };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/admin/",
          "/checkout/",
          "/auth/",
          "/login",
          "/signup",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
