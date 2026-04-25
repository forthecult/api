import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { aiEncryptedBackupTable } from "~/db/schema/ai-chat/tables";
import { auth } from "~/lib/auth";

const MAX_BACKUP_BYTES = 2 * 1024 * 1024;

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await db
    .delete(aiEncryptedBackupTable)
    .where(eq(aiEncryptedBackupTable.userId, session.user.id));
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const row = await db
    .select()
    .from(aiEncryptedBackupTable)
    .where(eq(aiEncryptedBackupTable.userId, session.user.id))
    .limit(1);
  if (!row[0]) {
    return NextResponse.json({ backup: null });
  }
  return NextResponse.json({
    backup: {
      algorithm: row[0].algorithm,
      ciphertext: row[0].ciphertext,
      keyDerivation: row[0].keyDerivation,
      nonce: row[0].nonce,
      updatedAt: row[0].updatedAt.toISOString(),
    },
  });
}

export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: {
    algorithm?: string;
    ciphertext?: string;
    keyDerivation?: Record<string, unknown>;
    nonce?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    typeof body.ciphertext !== "string" ||
    typeof body.nonce !== "string" ||
    typeof body.algorithm !== "string"
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (body.ciphertext.length > MAX_BACKUP_BYTES) {
    return NextResponse.json({ error: "Backup too large" }, { status: 413 });
  }
  const now = new Date();
  await db
    .insert(aiEncryptedBackupTable)
    .values({
      algorithm: body.algorithm,
      ciphertext: body.ciphertext,
      keyDerivation: body.keyDerivation ?? {},
      nonce: body.nonce,
      updatedAt: now,
      userId: session.user.id,
    })
    .onConflictDoUpdate({
      set: {
        algorithm: body.algorithm,
        ciphertext: body.ciphertext,
        keyDerivation: body.keyDerivation ?? {},
        nonce: body.nonce,
        updatedAt: now,
      },
      target: aiEncryptedBackupTable.userId,
    });
  return NextResponse.json({ ok: true });
}
