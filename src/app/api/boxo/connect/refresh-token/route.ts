import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { boxoTokenTable } from "~/db/schema";
import { verifyBoxoAuthorization } from "~/lib/boxo-auth";

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * POST /api/boxo/connect/refresh-token
 * Called by Boxo to refresh an access token. Body: { refresh_token }.
 * Returns { access_token, refresh_token }.
 */
export async function POST(request: NextRequest) {
  if (!verifyBoxoAuthorization(request.headers.get("Authorization"))) {
    return NextResponse.json(
      { error_code: "INVALID_CREDENTIALS" },
      { status: 401 },
    );
  }

  let body: { refresh_token?: string };
  try {
    body = (await request.json()) as { refresh_token?: string };
  } catch {
    return NextResponse.json(
      { error_code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  const refreshToken = body.refresh_token?.trim();
  if (!refreshToken) {
    return NextResponse.json(
      { error_code: "INVALID_REFRESH_TOKEN" },
      { status: 200 },
    );
  }

  const [row] = await db
    .select()
    .from(boxoTokenTable)
    .where(eq(boxoTokenTable.refreshToken, refreshToken))
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error_code: "INVALID_REFRESH_TOKEN" },
      { status: 200 },
    );
  }

  const newAccessToken = randomToken();
  const newRefreshToken = randomToken();
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
  const now = new Date();

  await db
    .delete(boxoTokenTable)
    .where(eq(boxoTokenTable.accessToken, row.accessToken));

  await db.insert(boxoTokenTable).values({
    accessToken: newAccessToken,
    userId: row.userId,
    refreshToken: newRefreshToken,
    expiresAt,
    createdAt: now,
  });

  return NextResponse.json({
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
  });
}
