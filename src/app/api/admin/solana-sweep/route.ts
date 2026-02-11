import { type NextRequest, NextResponse } from "next/server";

import {
  adminAuthFailureResponse,
  getAdminAuth,
} from "~/lib/admin-api-auth";
import { runSolanaSweep } from "~/lib/solana-sweep";

const VALID_SCOPES = ["paid", "pending", "all"] as const;
type SweepScope = (typeof VALID_SCOPES)[number];

/**
 * POST /api/admin/solana-sweep
 * Body: { dryRun: boolean, scope?: "paid" | "pending" | "all" }
 * Runs a dry run (list only) or actual sweep of Solana Pay deposit addresses.
 * scope: "paid" = only confirmed paid (default, safe); "pending" = only pending; "all" = both.
 * Admin only (session or API key).
 */
export async function POST(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  let body: { dryRun?: boolean; scope?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const dryRun = Boolean(body.dryRun);
  const scope: SweepScope = VALID_SCOPES.includes(body.scope as SweepScope)
    ? (body.scope as SweepScope)
    : "paid";

  try {
    const result = await runSolanaSweep(dryRun, scope);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Solana sweep error:", err);
    return NextResponse.json(
      {
        ok: false,
        dryRun: false,
        scope: "paid",
        configError: err instanceof Error ? err.message : String(err),
        ordersCount: 0,
        results: [],
      },
      { status: 500 },
    );
  }
}
