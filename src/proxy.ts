import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

import {
  AFFILIATE_COOKIE_MAX_AGE_SECONDS,
  AFFILIATE_COOKIE_NAME,
} from "~/lib/affiliate-tracking";

const DEFAULT_ADMIN_ORIGINS = [
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];

function getAllowedAdminOrigins(): string[] {
  const fromEnv = process.env.NEXT_PUBLIC_ADMIN_APP_URL?.trim();
  if (fromEnv) return [fromEnv];
  return DEFAULT_ADMIN_ORIGINS;
}

function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const allowed = getAllowedAdminOrigins();
  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
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
  // Americas
  US: "US",
  CA: "CA",
  MX: "MX",
  BR: "BR",
  AR: "AR",
  CL: "CL",
  CR: "CR",
  PA: "PA",
  SV: "SV",
  BZ: "BZ",
  KN: "KN",
  // Europe
  GB: "GB",
  DE: "DE",
  FR: "FR",
  ES: "ES",
  IT: "IT",
  NL: "NL",
  BE: "BE",
  AT: "AT",
  CH: "CH",
  IE: "IE",
  PT: "PT",
  PL: "PL",
  SE: "SE",
  NO: "NO",
  DK: "DK",
  FI: "FI",
  IS: "IS",
  LU: "LU",
  LI: "LI",
  LT: "LT",
  EE: "EE",
  ME: "ME",
  // Asia Pacific
  AU: "AU",
  NZ: "NZ",
  JP: "JP",
  KR: "KR",
  HK: "HK",
  SG: "SG",
  TW: "TW",
  PH: "PH",
  IN: "IN",
  FJ: "FJ",
  // Middle East
  IL: "IL",
  AE: "AE",
  SA: "SA",
  QA: "QA",
};

const COUNTRY_CURRENCY_COOKIE = "country-currency";

// Simple in-memory rate limit for proxy (edge-compatible)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function proxyHandler(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isAuthApi = path.startsWith("/api/auth/");
  const isAdminApi = path.startsWith("/api/admin/");
  const isUserApi = path.startsWith("/api/user/");

  // API auth/admin/user: CORS for admin app (e.g. profile from localhost:3001), OPTIONS, rate limit for admin
  if (isAuthApi || isAdminApi || isUserApi) {
    if (isAdminApi) {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";
      const now = Date.now();
      const key = `mw:${ip}`;
      let entry = rateLimitStore.get(key);

      if (!entry || entry.resetAt < now) {
        entry = { count: 1, resetAt: now + 60_000 };
        rateLimitStore.set(key, entry);
      } else {
        entry.count++;
        if (entry.count > 60) {
          const cors = getCorsHeaders(request);
          return new NextResponse(
            JSON.stringify({ error: "Too many requests" }),
            {
              headers: {
                "Content-Type": "application/json",
                "Retry-After": "60",
                "X-RateLimit-Remaining": "0",
                ...cors,
              },
              status: 429,
            },
          );
        }
      }
    }

    const corsHeaders = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        headers: corsHeaders,
        status: 204,
      });
    }

    const res = NextResponse.next();
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.headers.set(key, value);
    });
    return res;
  }

  // Page/document request: set country cookie from geo when absent (first visit)
  const res = NextResponse.next();
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
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
  }

  // Affiliate referral: set cookie when visitor lands with ?ref=CODE (90-day attribution)
  const ref = request.nextUrl.searchParams.get("ref");
  if (ref && ref.trim().length > 0) {
    const code = ref.trim().slice(0, 64); // reasonable max length
    res.cookies.set(AFFILIATE_COOKIE_NAME, code, {
      path: "/",
      maxAge: AFFILIATE_COOKIE_MAX_AGE_SECONDS,
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
