/**
 * GET /api/cron/email-funnels
 *
 * Processes scheduled marketing drip rows (`email_funnel_enrollment`). Secured with CRON_SECRET.
 * Configure PostHog flags `email_funnel_coupon_ab` and `email_funnel_content_ab` for A/B tests
 * (coupon timing, amounts, creative, segments). Abandon-cart **enrollment** runs on
 * `GET /api/cron/cart-abandon-enroll` (idle server cart snapshots).
 * This cron also runs abandon-cart **enrollment** so one scheduler can cover both.
 */

import { NextResponse } from "next/server";

import { processCartAbandonmentEnrollments } from "~/lib/email/process-cart-abandonment-enrollments";
import { processDueEmailFunnels } from "~/lib/email/process-email-funnels";
import { processWinBackEnrollments } from "~/lib/email/process-win-back-enrollments";

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
    return NextResponse.json(
      { error: "Unauthorized", ok: false },
      { status: 401 },
    );
  }

  try {
    const drip = await processDueEmailFunnels();
    const cart = await processCartAbandonmentEnrollments();
    const winBack = await processWinBackEnrollments();
    return NextResponse.json({
      ok: true,
      cartAbandonEnrolled: cart.enrolled,
      winBackEnrolled: winBack.enrolled,
      ...drip,
    });
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
