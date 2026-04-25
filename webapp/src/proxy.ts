import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

import {
  AFFILIATE_COOKIE_MAX_AGE_SECONDS,
  AFFILIATE_COOKIE_NAME,
} from "~/lib/affiliate-tracking";
import { getAgentHostname } from "~/lib/app-url";

const DEFAULT_ADMIN_ORIGINS = [
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];

function getAllowedAdminOrigins(): string[] {
  const fromEnv = process.env.NEXT_PUBLIC_ADMIN_APP_URL?.trim();
  if (fromEnv) return [fromEnv];
  return DEFAULT_ADMIN_ORIGINS;
}

function getCorsHeaders(request: NextRequest): null | Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const allowed = getAllowedAdminOrigins();
  // Only set CORS headers for recognized origins — never fall back to the first allowed origin
  const allowOrigin = origin && allowed.includes(origin) ? origin : null;
  if (!allowOrigin) return null;
  return {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With, Accept, Origin",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Origin": allowOrigin,
  };
}

/** Map Vercel geo country (ISO 3166-1 alpha-2) to our CountryCode. Only set cookie when we support the country. */
const GEO_TO_COUNTRY: Record<string, string> = {
  AE: "AE",
  AR: "AR",
  AT: "AT",
  // Asia Pacific
  AU: "AU",
  BE: "BE",
  BR: "BR",
  BZ: "BZ",
  CA: "CA",
  CH: "CH",
  CL: "CL",
  CR: "CR",
  DE: "DE",
  DK: "DK",
  EE: "EE",
  ES: "ES",
  FI: "FI",
  FJ: "FJ",
  FR: "FR",
  // Europe
  GB: "GB",
  HK: "HK",
  IE: "IE",
  // Middle East
  IL: "IL",
  IN: "IN",
  IS: "IS",
  IT: "IT",
  JP: "JP",
  KN: "KN",
  KR: "KR",
  LI: "LI",
  LT: "LT",
  LU: "LU",
  ME: "ME",
  MX: "MX",
  NL: "NL",
  NO: "NO",
  NZ: "NZ",
  PA: "PA",
  PH: "PH",
  PL: "PL",
  PT: "PT",
  QA: "QA",
  SA: "SA",
  SE: "SE",
  SG: "SG",
  SV: "SV",
  TW: "TW",
  // Americas
  US: "US",
};

const COUNTRY_CURRENCY_COOKIE = "country-currency";

function proxyHandler(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const host = request.nextUrl.hostname?.toLowerCase();

  // http → https redirect for production domains (single preferred version for SEO)
  if (
    request.nextUrl.protocol === "http:" &&
    host &&
    host !== "localhost" &&
    host !== "127.0.0.1" &&
    !host.endsWith(".localhost")
  ) {
    const httpsUrl = new URL(request.url);
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 301);
  }

  // malformed path from bad links (e.g. .../&) — 301 so crawlers don't keep 404ing on junk
  if (path === "/&" || path === "/%26") {
    const agentHost = getAgentHostname();
    const dest =
      agentHost && host === agentHost
        ? new URL("/for-agents", request.url)
        : new URL("/", request.url);
    return NextResponse.redirect(dest, 301);
  }

  // AI subdomain redirect: ai.forthecult.store/ → /for-agents
  const agentHost = getAgentHostname();
  if (agentHost && host === agentHost && (path === "/" || path === "")) {
    return NextResponse.redirect(new URL("/for-agents", request.url));
  }

  const isAuthApi = path.startsWith("/api/auth/");
  const isAdminApi = path.startsWith("/api/admin/");
  const isUserApi = path.startsWith("/api/user/");

  // API auth/admin/user: CORS for admin app (e.g. profile from localhost:3001), OPTIONS
  if (isAuthApi || isAdminApi || isUserApi) {
    const corsHeaders = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        headers: corsHeaders ?? {},
        status: 204,
      });
    }

    const res = NextResponse.next();
    if (corsHeaders) {
      Object.entries(corsHeaders).forEach(([key, value]) => {
        res.headers.set(key, value);
      });
    }
    return res;
  }

  // Page/document request: set country cookie from geo when absent (first visit)
  const res = NextResponse.next();

  // X-Robots-Tag: noindex, nofollow for dashboard/admin so crawlers do not index these pages
  const isNoIndexPath =
    path.startsWith("/dashboard") || path.startsWith("/admin");
  if (isNoIndexPath) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  const existing = request.cookies.get(COUNTRY_CURRENCY_COOKIE)?.value;
  if (!existing) {
    // Try multiple geo header sources (Vercel, Cloudflare, generic)
    const vercelGeo = request.headers.get("x-vercel-ip-country");
    const cloudflareGeo = request.headers.get("cf-ipcountry");
    const genericGeo = request.headers.get("x-country");
    const geo = vercelGeo || cloudflareGeo || genericGeo;
    const country = geo ? GEO_TO_COUNTRY[geo.toUpperCase()] : null;
    if (country) {
      res.cookies.set(COUNTRY_CURRENCY_COOKIE, country, {
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
        sameSite: "lax",
      });
    }
  }

  // Affiliate referral: set cookie when visitor lands with ?ref=CODE (90-day attribution)
  const ref = request.nextUrl.searchParams.get("ref");
  if (ref && ref.trim().length > 0) {
    const code = ref.trim().slice(0, 64); // reasonable max length
    res.cookies.set(AFFILIATE_COOKIE_NAME, code, {
      httpOnly: true,
      maxAge: AFFILIATE_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
    });
  }

  return res;
}

/** Next.js proxy: default export (replaces deprecated middleware.ts). */
export default proxyHandler;

export const config = {
  matcher: [
    "/api/auth/:path*",
    "/api/admin/:path*",
    "/api/user/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|woff2?)).*)",
  ],
};
