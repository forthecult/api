import { type NextRequest, NextResponse } from "next/server";

import { resolveGeoRegionForCheckout } from "~/lib/geo-subdivision";

export async function GET(request: NextRequest) {
  const vercelCountry = request.headers.get("x-vercel-ip-country");
  const cloudflareCountry = request.headers.get("cf-ipcountry");
  const genericCountry = request.headers.get("x-country");

  let country =
    (vercelCountry || cloudflareCountry || genericCountry)
      ?.trim()
      .toUpperCase()
      .slice(0, 2) ?? null;

  const vercelRegion = request.headers.get("x-vercel-ip-country-region");
  const cloudflareRegion = request.headers.get("cf-ipregion");
  const genericRegion = request.headers.get("x-region-code");

  let regionCode =
    (vercelRegion || cloudflareRegion || genericRegion)?.trim() || null;
  if (regionCode === "") regionCode = null;

  let regionName: string | null = null;

  const clientIp = getClientIp(request);
  if (clientIp) {
    try {
      const geoResponse = await fetch(
        `http://ip-api.com/json/${clientIp}?fields=countryCode,region,regionName`,
        { signal: AbortSignal.timeout(2000) },
      );
      if (geoResponse.ok) {
        const data = (await geoResponse.json()) as {
          countryCode?: string;
          region?: string;
          regionName?: string;
        };
        if ((!country || country.length !== 2) && data.countryCode) {
          const c = data.countryCode.trim().toUpperCase();
          if (c.length === 2) country = c;
        }
        const ipRegion =
          typeof data.region === "string" ? data.region.trim() : "";
        if (ipRegion && (regionCode ?? "").trim() === "") {
          regionCode = ipRegion;
        }
        const ipRegionName =
          typeof data.regionName === "string" ? data.regionName.trim() : "";
        if (ipRegionName && (regionName ?? "").trim() === "") {
          regionName = ipRegionName;
        }
      }
    } catch {
      // ignore
    }
  }

  let finalRegion: null | string = null;
  if (country && country.length === 2) {
    finalRegion = resolveGeoRegionForCheckout(
      country,
      regionCode ?? undefined,
      regionName ?? undefined,
    );
    if (!finalRegion && regionCode?.trim()) {
      finalRegion = regionCode.trim();
    }
  } else {
    finalRegion = regionCode?.trim() || null;
  }

  return NextResponse.json({
    country: country && country.length === 2 ? country : null,
    region: finalRegion && finalRegion.length > 0 ? finalRegion : null,
    regionName: regionName && regionName.length > 0 ? regionName : null,
  });
}

/**
 * Returns coarse client geo: ISO country, normalized subdivision (`region`),
 * and optional `regionName` when available (e.g. from ip-api).
 *
 * Sources (in order):
 * 1. Vercel: x-vercel-ip-country, x-vercel-ip-country-region
 * 2. Cloudflare: cf-ipcountry, cf-ipregion
 * 3. Generic: x-country, x-region-code
 * 4. ip-api.com (HTTP) when client IP is known — fills missing country, region,
 *    or regionName without overwriting values already set from headers.
 *
 * `region` is normalized for checkout where we can (US, CA, AU); elsewhere the
 * best subdivision string from geo is returned.
 *
 * GET /api/geo
 */
function getClientIp(request: NextRequest): null | string {
  const cfConnecting = request.headers.get("cf-connecting-ip")?.trim();
  const flyClient = request.headers.get("fly-client-ip")?.trim();
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip")?.trim();
  const ip =
    cfConnecting ||
    flyClient ||
    forwardedFor?.split(",")[0]?.trim() ||
    realIp ||
    null;
  if (
    !ip ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.")
  ) {
    return null;
  }
  return ip;
}
