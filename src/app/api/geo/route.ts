import { type NextRequest, NextResponse } from "next/server";

/**
 * Returns the request's country from Vercel geo (x-vercel-ip-country).
 * Used for shipping availability (e.g. show "Unavailable in your country" on product pages).
 * GET /api/geo
 */
export async function GET(request: NextRequest) {
  const country = request.headers.get("x-vercel-ip-country")?.trim().toUpperCase().slice(0, 2) ?? null;
  return NextResponse.json({ country: country && country.length === 2 ? country : null });
}
