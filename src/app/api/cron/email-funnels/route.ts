/**
 * GET /api/cron/email-funnels
 *
 * Processes scheduled marketing drip rows (`email_funnel_enrollment`). Secured with CRON_SECRET.
 * Configure PostHog flags `email_funnel_coupon_ab` and `email_funnel_content_ab` for A/B tests
 * (coupon timing, amounts, creative, segments). Abandon-cart **enrollment** runs on
 * `GET /api/cron/cart-abandon-enroll` (idle server cart snapshots).
 */

import { NextResponse } from "next/server";

import { processDueEmailFunnels } from "~/lib/email/process-email-funnels";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const secret = process.env.CRON_SECRET?.trim() ?? null;

  if (!secret) {
    return NextResponse.json(
      { error: "Cron not configured (CRON_SECRET missing)", ok: false },
      { status: 503 },
    );
  }

  if (token !== secret) {
    return NextResponse.json({ error: "Unauthorized", ok: false }, { status: 401 });
  }

  try {
    const result = await processDueEmailFunnels();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron] email-funnels error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "email-funnels failed",
        ok: false,
      },
      { status: 500 },
    );
  }
}
