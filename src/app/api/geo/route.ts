import { type NextRequest, NextResponse } from "next/server";

/**
 * Returns coarse client geo: ISO country and region (e.g. US state code) when available.
 * Sources (in order):
 * 1. Vercel: x-vercel-ip-country, x-vercel-ip-country-region
 * 2. Cloudflare: cf-ipcountry, cf-ipregion (when present)
 * 3. Generic: x-country, x-region-code
 * 4. ip-api.com (HTTP) for country/region from client IP
 *
 * GET /api/geo
 */
function getClientIp(request: NextRequest): null | string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp || null;
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
    (vercelRegion || cloudflareRegion || genericRegion)
      ?.trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 5) || null;
  if (regionCode === "") regionCode = null;
  if (regionCode && regionCode.length < 2) regionCode = null;

  if (!country || country.length !== 2 || !regionCode) {
    try {
      const ip = getClientIp(request);
      if (ip) {
        // NOTE: ip-api.com free tier uses HTTP. Consider an HTTPS provider for production.
        const geoResponse = await fetch(
          `http://ip-api.com/json/${ip}?fields=countryCode,region`,
          { signal: AbortSignal.timeout(2000) },
        );
        if (geoResponse.ok) {
          const data = (await geoResponse.json()) as {
            countryCode?: string;
            region?: string;
          };
          if ((!country || country.length !== 2) && data.countryCode) {
            const c = data.countryCode.trim().toUpperCase();
            if (c.length === 2) country = c;
          }
          if (!regionCode && data.region) {
            regionCode =
              data.region
                .trim()
                .toUpperCase()
                .replace(/[^A-Z]/g, "")
                .slice(0, 5) || null;
            if (regionCode && regionCode.length < 2) regionCode = null;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  if (country === "US" && regionCode && regionCode.length > 2) {
    regionCode = regionCode.slice(0, 2);
  }

  return NextResponse.json({
    country: country && country.length === 2 ? country : null,
    region: regionCode,
  });
}
