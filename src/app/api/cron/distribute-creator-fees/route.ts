/**
 * GET /api/cron/distribute-creator-fees
 *
 * Daily cron: distributes SOL from the creator fee wallet to Tier 1 stakers.
 * Secured with CRON_SECRET (Bearer token). Idempotent: skips if already ran today.
 *
 * Vercel Cron invokes this at midnight UTC; alternatively call with:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/distribute-creator-fees
 */

import { NextResponse } from "next/server";

import { runDailyDistribution } from "~/lib/creator-fee-distribution";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const secret = getCronSecret();

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
    const result = await runDailyDistribution({ force: false });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron] distribute-creator-fees error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Distribution failed",
        ok: false,
      },
      { status: 500 },
    );
  }
}

function getCronSecret(): null | string {
  const s = process.env.CRON_SECRET?.trim();
  return s ?? null;
}
