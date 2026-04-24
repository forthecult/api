/**
 * GET /api/cron/cart-abandon-enroll
 *
 * Enrolls idle signed-in carts into the 3-step abandon series. Secured with CRON_SECRET.
 */

import { NextResponse } from "next/server";

import { processCartAbandonmentEnrollments } from "~/lib/email/process-cart-abandonment-enrollments";

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
    const result = await processCartAbandonmentEnrollments();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron] cart-abandon-enroll error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "cart-abandon-enroll failed",
        ok: false,
      },
      { status: 500 },
    );
  }
}
