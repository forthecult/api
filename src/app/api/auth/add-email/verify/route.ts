import { and, eq, gt } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { verificationTable } from "~/db/schema";
import { auth } from "~/lib/auth";

const ADD_EMAIL_PREFIX = "add-email:";

/**
 * POST /api/auth/add-email/verify
 * Body: { email: string, code: string }
 * Requires session. Verifies the code sent to the email. If valid, deletes the code and returns { ok: true }.
 * The client should then call updateUser({ email }) and setPassword({ newPassword }) to complete adding email & password.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";

  if (!email || !code) {
    return NextResponse.json(
      { error: "Email and code are required" },
      { status: 400 },
    );
  }

  const identifier = `${ADD_EMAIL_PREFIX}${session.user.id}:${email}`;
  const now = new Date();

  const [row] = await db
    .select({
      id: verificationTable.id,
      value: verificationTable.value,
    })
    .from(verificationTable)
    .where(
      and(
        eq(verificationTable.identifier, identifier),
        gt(verificationTable.expiresAt, now),
      ),
    )
    .limit(1);

  if (!row || row.value !== code) {
    return NextResponse.json(
      { error: "Invalid or expired code. Request a new one." },
      { status: 400 },
    );
  }

  await db
    .delete(verificationTable)
    .where(eq(verificationTable.id, row.id));

  return NextResponse.json({ ok: true });
}
