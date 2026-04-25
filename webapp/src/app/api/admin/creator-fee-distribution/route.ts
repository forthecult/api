import { desc, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { creatorFeeDistributionTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import { runDailyDistribution } from "~/lib/creator-fee-distribution";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * GET /api/admin/creator-fee-distribution
 * Query: page=1&limit=20
 * Returns paginated list of past distributions (newest first).
 */
export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT),
  );
  const offset = (page - 1) * limit;

  try {
    const distributions = await db
      .select()
      .from(creatorFeeDistributionTable)
      .orderBy(desc(creatorFeeDistributionTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(creatorFeeDistributionTable);

    return NextResponse.json({
      distributions,
      limit,
      page,
      total: countRow?.count ?? 0,
    });
  } catch (err) {
    console.error("[admin] creator-fee-distribution list error:", err);
    return NextResponse.json(
      { error: "Failed to list distributions" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/creator-fee-distribution
 * Body: { force?: boolean } — force=true runs even if already ran today.
 * Manually triggers a creator fee distribution.
 */
export async function POST(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  let body: { force?: boolean } = {};
  try {
    body = (await request.json().catch(() => ({}))) as { force?: boolean };
  } catch {
    // empty body is ok
  }

  const force = Boolean(body.force);

  try {
    const result = await runDailyDistribution({ force });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[admin] creator-fee-distribution trigger error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Distribution failed",
        ok: false,
      },
      { status: 500 },
    );
  }
}
