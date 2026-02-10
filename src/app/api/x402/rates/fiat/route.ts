import { type NextRequest, NextResponse } from "next/server";

import { getFiatRate } from "~/lib/x402-rates";
import { withOptionalX402 } from "~/lib/x402-config";

/**
 * GET /api/x402/rates/fiat?from=USD&to=EUR
 * Fiat-to-fiat exchange rate. Uses Frankfurter (free) for common pairs.
 */
async function getHandler(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from") ?? "USD";
  const to = searchParams.get("to") ?? "EUR";
  const rate = await getFiatRate(from, to);
  if (rate === null) {
    return NextResponse.json(
      {
        error: "Unsupported or invalid fiat pair",
        from,
        to,
        supported: ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD"],
      },
      { status: 400 },
    );
  }
  return NextResponse.json({
    from,
    to,
    rate,
    source: "frankfurter",
    _note: "Rate is 1 unit of 'from' in units of 'to'",
  });
}

export const GET = withOptionalX402(getHandler, "x402/rates/fiat");
