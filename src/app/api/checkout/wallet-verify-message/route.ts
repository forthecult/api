import { NextResponse } from "next/server";

import { getTierVerificationMessage } from "~/lib/wallet-tier-verify";

/**
 * GET /api/checkout/wallet-verify-message
 * Returns the message a client must sign to prove they control a wallet for tier discounts.
 * Client signs this message with their wallet, then sends wallet + message + signature
 * in checkout or automatic-coupon requests. Message is valid for 5 minutes.
 */
export async function GET() {
  const message = getTierVerificationMessage();
  return NextResponse.json({
    expiresInSeconds: 300,
    message,
  });
}
