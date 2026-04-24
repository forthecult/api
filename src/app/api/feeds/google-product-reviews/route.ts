import { NextResponse } from "next/server";

/**
 * Stub for [Google Merchant product review feeds](https://developers.google.com/product-review-feeds/schema).
 * Returns a minimal valid XML shell with zero reviews until we wire verified
 * reviews + GTIN/MPN from the catalog (see notes.txt).
 */
export async function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:vc="http://www.w3.org/2007/XMLSchema-versioning"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:noNamespaceSchemaLocation="http://www.google.com/shopping/reviews/schema/product/2.3/product_reviews.xsd">
  <version>2.3</version>
  <aggregator>
    <name>${escapeXml("For the Cult")}</name>
  </aggregator>
  <publisher>
    <name>${escapeXml("For the Cult")}</name>
    <favicon>https://forthecult.store/favicon.ico</favicon>
  </publisher>
  <reviews />
</feed>
`;

  return new NextResponse(xml, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
