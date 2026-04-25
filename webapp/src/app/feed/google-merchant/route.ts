import { NextResponse } from "next/server";

import { buildGoogleMerchantFeedXml } from "~/lib/google-merchant-feed";

export const dynamic = "force-dynamic";

/**
 * Google Merchant Center primary feed (RSS 2.0 + `g:` namespace).
 * Protected by `MERCHANT_FEED_TOKEN` (query `?token=`); omit token env in dev to disable.
 */
export async function GET(request: Request) {
  const expected = process.env.MERCHANT_FEED_TOKEN?.trim();
  if (!expected) {
    return new NextResponse("Merchant feed is not configured.", {
      status: 503,
    });
  }
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const xml = await buildGoogleMerchantFeedXml();
  return new NextResponse(xml, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
