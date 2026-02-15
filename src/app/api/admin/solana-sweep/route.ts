import { type NextRequest, NextResponse } from "next/server";

import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import { runSolanaSweep } from "~/lib/solana-sweep";

const VALID_SCOPES = ["paid", "pending", "all"] as const;
type SweepScope = (typeof VALID_SCOPES)[number];

/**
 * POST /api/admin/solana-sweep
 * Body: { dryRun: boolean, scope?: "paid" | "pending" | "all" }
 * Runs a dry run (list only) or actual sweep of Solana Pay deposit addresses.
 * scope: "paid" = only confirmed paid (default, safe); "pending" = only pending; "all" = both.
 *
 * Security: Admin-only (session or API key). All sweep logic runs server-side.
 * SOLANA_SWEEP_FEE_PAYER_SECRET and SOLANA_DEPOSIT_SECRET are never returned
 * or logged; response contains only order ids, amounts, tx signatures, and errors.
 */
export async function POST(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  let body: { dryRun?: boolean; scope?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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
    // Do not send raw error details to client (could contain env or internal state)
    return NextResponse.json(
      {
        ok: false,
        dryRun: false,
        scope: "paid",
        configError: "Sweep failed. Check server logs.",
        ordersCount: 0,
        results: [],
      },
      { status: 500 },
    );
  }
}
