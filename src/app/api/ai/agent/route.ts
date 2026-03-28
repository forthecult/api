import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "~/lib/auth";
import { db } from "~/db";
import {
  AI_BACKUP_MODE_VALUES,
  aiAgentTable,
} from "~/db/schema/ai-chat/tables";
import { getOrCreateAiAgent } from "~/lib/ai/user-agent";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const row = await getOrCreateAiAgent(session.user.id);
  return NextResponse.json({
    agent: {
      backupMode: row.backupMode,
      characterName: row.characterName,
      characterSlug: row.characterSlug,
      id: row.id,
      jsonSettings: row.jsonSettings,
      localCacheEncrypted: row.localCacheEncrypted,
      name: row.name,
      userPrompt: row.userPrompt,
      userRagEnabled: row.userRagEnabled,
      veniceApiKeySet: Boolean(row.veniceApiKey?.trim()),
    },
  });
}

export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await getOrCreateAiAgent(session.user.id);
  const backupMode = body.backupMode;
  if (
    typeof backupMode === "string" &&
    !AI_BACKUP_MODE_VALUES.includes(
      backupMode as (typeof AI_BACKUP_MODE_VALUES)[number],
    )
  ) {
    return NextResponse.json({ error: "Invalid backupMode" }, { status: 400 });
  }

  await db
    .update(aiAgentTable)
    .set({
      backupMode:
        typeof backupMode === "string" ? backupMode : existing.backupMode,
      characterName:
        typeof body.characterName === "string" || body.characterName === null
          ? (body.characterName as string | null)
          : existing.characterName,
      characterSlug:
        typeof body.characterSlug === "string" || body.characterSlug === null
          ? (body.characterSlug as string | null)
          : existing.characterSlug,
      jsonSettings:
        body.jsonSettings !== undefined
          ? (body.jsonSettings as Record<string, unknown>)
          : existing.jsonSettings,
      localCacheEncrypted:
        typeof body.localCacheEncrypted === "boolean"
          ? body.localCacheEncrypted
          : existing.localCacheEncrypted,
      name:
        typeof body.name === "string" || body.name === null
          ? (body.name as string | null)
          : existing.name,
      updatedAt: new Date(),
      userPrompt:
        typeof body.userPrompt === "string" || body.userPrompt === null
          ? (body.userPrompt as string | null)
          : existing.userPrompt,
      userRagEnabled:
        typeof body.userRagEnabled === "boolean"
          ? body.userRagEnabled
          : existing.userRagEnabled,
      veniceApiKey:
        typeof body.veniceApiKey === "string" || body.veniceApiKey === null
          ? (body.veniceApiKey as string | null)
          : existing.veniceApiKey,
    })
    .where(eq(aiAgentTable.id, existing.id));

  const row = await getOrCreateAiAgent(session.user.id);
  return NextResponse.json({
    agent: {
      backupMode: row.backupMode,
      characterName: row.characterName,
      characterSlug: row.characterSlug,
      id: row.id,
      jsonSettings: row.jsonSettings,
      localCacheEncrypted: row.localCacheEncrypted,
      name: row.name,
      userPrompt: row.userPrompt,
      userRagEnabled: row.userRagEnabled,
      veniceApiKeySet: Boolean(row.veniceApiKey?.trim()),
    },
  });
}
