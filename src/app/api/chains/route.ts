import { NextResponse } from "next/server";

import { getSupportedChains } from "~/lib/supported-payment-chains";

/**
 * Supported chains and tokens for payment. Prefer GET /api/payment-methods for
 * the canonical list (expandable to non-blockchain methods). This endpoint
 * remains for backward compatibility.
 * GET /api/chains
 */
export async function GET() {
  return NextResponse.json({ chains: getSupportedChains() });
}
