import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import {
  getAgentBaseUrl,
  getPublicSiteUrl,
  isAgentSubdomain,
} from "~/lib/app-url";

/** Staging: Vercel preview deploys or explicit STAGING=1 (e.g. Railway). Production allows crawlers. */
const isStaging =
  process.env.VERCEL_ENV === "preview" || process.env.STAGING === "1";

export default async function robots(): Promise<MetadataRoute.Robots> {
  if (isStaging) {
    return {
      rules: [{ userAgent: "*", disallow: ["/"] }],
    };
  }

  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const isAgent = isAgentSubdomain(host);
  const baseUrl = isAgent ? getAgentBaseUrl() : getPublicSiteUrl();

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
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
