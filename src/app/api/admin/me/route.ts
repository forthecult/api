import { type NextRequest, NextResponse } from "next/server";

import { getAdminAuth } from "~/lib/admin-api-auth";

export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
