import { type NextRequest, NextResponse } from "next/server";

import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);
  return NextResponse.json({
    method: authResult.method,
    ok: true,
    ...(authResult.method === "session" && authResult.user
      ? { email: authResult.user.email }
      : {}),
  });
}
