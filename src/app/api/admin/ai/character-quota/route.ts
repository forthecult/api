import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { aiCharacterQuotaTable } from "~/db/schema/ai-chat/tables";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);
  const rows = await db.select().from(aiCharacterQuotaTable);
  return NextResponse.json({ quotas: rows });
}

export async function PUT(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);
  let body: {
    characterSlug?: string;
    enabled?: boolean;
    label?: null | string;
    maxFreeMessagesNonMember?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.characterSlug?.trim()) {
    return NextResponse.json(
      { error: "characterSlug required" },
      { status: 400 },
    );
  }
  const slug = body.characterSlug.trim();
  const now = new Date();
  await db
    .insert(aiCharacterQuotaTable)
    .values({
      characterSlug: slug,
      enabled: body.enabled ?? true,
      label: body.label ?? null,
      maxFreeMessagesNonMember: body.maxFreeMessagesNonMember ?? 1,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        enabled: body.enabled ?? true,
        label: body.label ?? null,
        maxFreeMessagesNonMember: body.maxFreeMessagesNonMember ?? 1,
        updatedAt: now,
      },
      target: aiCharacterQuotaTable.characterSlug,
    });
  const row = await db
    .select()
    .from(aiCharacterQuotaTable)
    .where(eq(aiCharacterQuotaTable.characterSlug, slug))
    .limit(1);
  return NextResponse.json({ quota: row[0] });
}
