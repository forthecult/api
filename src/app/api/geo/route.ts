import { type NextRequest, NextResponse } from "next/server";

/**
 * Returns the request's country code.
 * Checks multiple sources in order:
 * 1. Vercel geo header (x-vercel-ip-country)
 * 2. Cloudflare geo header (cf-ipcountry)
 * 3. Railway/generic geo header (x-country)
 * 4. Fallback to free IP geolocation API
 *
 * GET /api/geo
 */
export async function GET(request: NextRequest) {
  // Try platform-specific geo headers first
  const vercelCountry = request.headers.get("x-vercel-ip-country");
  const cloudflareCountry = request.headers.get("cf-ipcountry");
  const genericCountry = request.headers.get("x-country");

  let country =
    (vercelCountry || cloudflareCountry || genericCountry)
      ?.trim()
      .toUpperCase()
      .slice(0, 2) ?? null;

  // If no geo header, try to get country from IP using a free service
  if (!country || country.length !== 2) {
    try {
      // Get client IP from headers
      const forwardedFor = request.headers.get("x-forwarded-for");
      const realIp = request.headers.get("x-real-ip");
      const ip = forwardedFor?.split(",")[0]?.trim() || realIp || null;

      if (
        ip &&
        ip !== "127.0.0.1" &&
        ip !== "::1" &&
        !ip.startsWith("192.168.") &&
        !ip.startsWith("10.")
      ) {
        // NOTE: ip-api.com free tier only supports HTTP. Consider switching to
        // an HTTPS provider (e.g. ipinfo.io, ipapi.co) for production use.
        const geoResponse = await fetch(
          `http://ip-api.com/json/${ip}?fields=countryCode`,
          {
            signal: AbortSignal.timeout(2000), // 2 second timeout
          },
        );
        if (geoResponse.ok) {
          const data = (await geoResponse.json()) as { countryCode?: string };
          if (data.countryCode && data.countryCode.length === 2) {
            country = data.countryCode.toUpperCase();
          }
        }
      }
    } catch {
      // Ignore errors from IP lookup - will return null
    }
  }

  return NextResponse.json({
    country: country && country.length === 2 ? country : null,
  });
}
