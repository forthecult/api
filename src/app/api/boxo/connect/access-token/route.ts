import { randomBytes } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, gt } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { boxoAuthCodeTable, boxoTokenTable } from "~/db/schema";
import { verifyBoxoAuthorization } from "~/lib/boxo-auth";

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * POST /api/boxo/connect/access-token
 * Called by Boxo platform to exchange an auth_code for an access_token (and optional refresh_token).
 * Headers: Authorization: Token <base64(client_id:secret)>, X-Miniapp-App-ID, X-Hostapp-Client-ID
 * Body: { auth_code }
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!verifyBoxoAuthorization(authHeader)) {
    return NextResponse.json(
      { error_code: "INVALID_CREDENTIALS" },
      { status: 401 },
    );
  }

  let body: { auth_code?: string };
  try {
    body = (await request.json()) as { auth_code?: string };
  } catch {
    return NextResponse.json(
      { error_code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  const authCode = body.auth_code?.trim();
  if (!authCode) {
    return NextResponse.json(
      { error_code: "INVALID_AUTH_CODE" },
      { status: 400 },
    );
  }

  const now = new Date();
  const [row] = await db
    .select()
    .from(boxoAuthCodeTable)
    .where(
      and(
        eq(boxoAuthCodeTable.code, authCode),
        gt(boxoAuthCodeTable.expiresAt, now),
      ),
    )
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error_code: "INVALID_AUTH_CODE" },
      { status: 200 },
    ); // Boxo docs: response 200 in all cases, use error_code for errors
  }

  // Delete the used auth code (one-time use)
  await db
    .delete(boxoAuthCodeTable)
    .where(eq(boxoAuthCodeTable.id, row.id));

  const accessToken = randomToken();
  const refreshToken = randomToken();
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await db.insert(boxoTokenTable).values({
    accessToken,
    userId: row.userId,
    refreshToken,
    expiresAt,
    createdAt: now,
  });

  // Store refresh token for later refresh endpoint (we use same row; Boxo may not call refresh)
  // Our schema has refreshToken on the same table; we could add a separate refresh_tokens table if we need to validate refresh. For now we only validate access_token for user-data. So we're good.

  return NextResponse.json({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
}
