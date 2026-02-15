import { createId } from "@paralleldrive/cuid2";
import { and, eq, gt } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { accountTable, userTable, verificationTable } from "~/db/schema";
import { auth } from "~/lib/auth";

const ADD_EMAIL_PREFIX = "add-email:";
const CREDENTIAL_PROVIDER_ID = "credential";

/**
 * POST /api/auth/add-email/verify
 * Body: { email: string, code: string }
 * Requires session. Verifies the code sent to the email. If valid, deletes the code,
 * updates the user's email (and emailVerified) in the DB, and ensures a credential
 * account exists so email OTP sign-in works. Returns { ok: true }.
 * Better-auth's updateUser() does not allow updating email, so we do it here after OTP verification.
 * The client should then call setPassword({ newPassword }) only if the user chose password sign-in.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { code?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const code =
    typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";

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

  await db.delete(verificationTable).where(eq(verificationTable.id, row.id));

  // Ensure email is not already used by another user
  const [existingByEmail] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);

  if (existingByEmail && existingByEmail.id !== session.user.id) {
    return NextResponse.json(
      { error: "This email is already used by another account." },
      { status: 400 },
    );
  }

  // Update user email and emailVerified (better-auth updateUser blocks email updates)
  await db
    .update(userTable)
    .set({
      email,
      emailVerified: true,
      updatedAt: now,
    })
    .where(eq(userTable.id, session.user.id));

  // Ensure a credential account exists so email OTP sign-in can link to this user
  const [existingCredential] = await db
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.userId, session.user.id),
        eq(accountTable.providerId, CREDENTIAL_PROVIDER_ID),
      ),
    )
    .limit(1);

  if (!existingCredential) {
    await db.insert(accountTable).values({
      accountId: email,
      createdAt: now,
      id: createId(),
      providerId: CREDENTIAL_PROVIDER_ID,
      updatedAt: now,
      userId: session.user.id,
    });
  }

  return NextResponse.json({ ok: true });
}
