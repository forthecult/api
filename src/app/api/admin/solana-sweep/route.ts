import { type NextRequest, NextResponse } from "next/server";

import {
  adminAuthFailureResponse,
  getAdminAuth,
} from "~/lib/admin-api-auth";
import { runSolanaSweep } from "~/lib/solana-sweep";

/**
 * POST /api/admin/solana-sweep
 * Body: { dryRun: boolean }
 * Runs a dry run (list only) or actual sweep of Solana Pay deposit addresses.
 * Admin only (session or API key).
 */
export async function POST(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  let body: { dryRun?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const dryRun = Boolean(body.dryRun);

  try {
    const result = await runSolanaSweep(dryRun);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Solana sweep error:", err);
    return NextResponse.json(
      {
        ok: false,
        dryRun: false,
        configError: err instanceof Error ? err.message : String(err),
        ordersCount: 0,
        results: [],
      },
      { status: 500 },
    );
  }
}
