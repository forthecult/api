import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { verificationTable } from "~/db/schema";
import { auth } from "~/lib/auth";
import { sendAddEmailVerificationCode } from "~/lib/send-add-email-code";

const CODE_EXPIRY_MINUTES = 10;
const ADD_EMAIL_PREFIX = "add-email:";

/**
 * POST /api/auth/add-email/send-code
 * Body: { email: string }
 * Requires session. Sends a 6-digit verification code to the email for adding email/password to the account.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const raw = typeof body.email === "string" ? body.email.trim() : "";
  if (!raw) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 },
    );
  }

  const email = raw.toLowerCase();
  const identifier = `${ADD_EMAIL_PREFIX}${session.user.id}:${email}`;

  // Delete any existing code for this user+email
  await db
    .delete(verificationTable)
    .where(eq(verificationTable.identifier, identifier));

  const code = Math.floor(100_000 + Math.random() * 900_000).toString();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  await db.insert(verificationTable).values({
    id: createId(),
    identifier,
    value: code,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  try {
    await sendAddEmailVerificationCode({ to: email, code });
  } catch (err) {
    console.error("[add-email/send-code] Failed to send email:", err);
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
