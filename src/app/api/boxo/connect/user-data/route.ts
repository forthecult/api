import { and, eq, gt } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { boxoTokenTable, userTable } from "~/db/schema";

const BOXO_ACCESS_TOKEN_PREFIX = process.env.BOXO_ACCESS_TOKEN_PREFIX ?? "Token";

/**
 * GET /api/boxo/connect/user-data
 * Called by Boxo platform with Authorization: Token <access_token>.
 * Returns user_data: { reference, email?, phone?, first_name?, last_name?, custom_attributes? }
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.trim()) {
    return NextResponse.json(
      { error_code: "INVALID_ACCESS_TOKEN" },
      { status: 200 },
    );
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length < 2 || parts[0] !== BOXO_ACCESS_TOKEN_PREFIX) {
    return NextResponse.json(
      { error_code: "INVALID_ACCESS_TOKEN" },
      { status: 200 },
    );
  }

  const accessToken = parts[1];
  const now = new Date();

  const [tokenRow] = await db
    .select()
    .from(boxoTokenTable)
    .where(
      and(
        eq(boxoTokenTable.accessToken, accessToken),
        gt(boxoTokenTable.expiresAt, now),
      ),
    )
    .limit(1);

  if (!tokenRow || tokenRow.expiresAt <= now) {
    return NextResponse.json(
      { error_code: "INVALID_ACCESS_TOKEN" },
      { status: 200 },
    );
  }

  const [user] = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      phone: userTable.phone,
      firstName: userTable.firstName,
      lastName: userTable.lastName,
    })
    .from(userTable)
    .where(eq(userTable.id, tokenRow.userId))
    .limit(1);

  if (!user) {
    return NextResponse.json(
      { error_code: "USER_NOT_FOUND" },
      { status: 200 },
    );
  }

  const user_data = {
    reference: user.id,
    email: user.email ?? undefined,
    phone: user.phone ?? undefined,
    first_name: user.firstName ?? undefined,
    last_name: user.lastName ?? undefined,
    custom_attributes: {},
  };

  return NextResponse.json({ user_data });
}
