import { type NextRequest, NextResponse } from "next/server";

import { withOptionalX402 } from "~/lib/x402-config";
import { getFiatRate } from "~/lib/x402-rates";

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
        supported: ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD"],
        to,
      },
      { status: 400 },
    );
  }
  return NextResponse.json({
    _note: "Rate is 1 unit of 'from' in units of 'to'",
    from,
    rate,
    source: "frankfurter",
    to,
  });
}

export const GET = withOptionalX402(getHandler, "x402/rates/fiat");
