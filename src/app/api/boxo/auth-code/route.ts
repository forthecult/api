import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { boxoAuthCodeTable } from "~/db/schema";
import { auth } from "~/lib/auth";
import { isBoxoConfigured } from "~/lib/boxo-auth";

const AUTH_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * POST /api/boxo/auth-code
 * Called by our frontend when the Boxo miniapp triggers login (onAuth).
 * Requires authenticated session. Returns a one-time auth_code for Boxo to exchange for an access token.
 */
export async function POST(request: NextRequest) {
  if (!isBoxoConfigured()) {
    return NextResponse.json(
      { error_code: "BOXO_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json(
      { error_code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const id = createId();
  const code = createId(); // opaque one-time code
  const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_MS);
  const createdAt = new Date();

  await db.insert(boxoAuthCodeTable).values({
    id,
    code,
    userId: session.user.id,
    expiresAt,
    createdAt,
  });

  return NextResponse.json({ auth_code: code });
}
