import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "~/db";
import {
  AI_BACKUP_MODE_VALUES,
  aiAgentTable,
} from "~/db/schema/ai-chat/tables";
import { getOrCreateAiAgent } from "~/lib/ai/user-agent";
import { auth } from "~/lib/auth";

// l4: jsonSettings is a free-form jsonb column on aiAgentTable but only a
// handful of keys are actually consumed by the app. Anything else is an
// injection surface (disk bloat, prototype pollution on downstream code that
// iterates keys). Maintain an explicit allowlist here and reject payloads
// carrying unknown keys.
const aiJsonSettingsSchema = z
  .object({
    personalAiWidgetEnabled: z.boolean().optional(),
  })
  .strict();

type AiJsonSettings = z.infer<typeof aiJsonSettingsSchema>;

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

  let jsonSettingsValue: AiJsonSettings | null | Record<string, unknown> =
    existing.jsonSettings;
  if (body.jsonSettings !== undefined) {
    if (body.jsonSettings === null) {
      jsonSettingsValue = null;
    } else {
      const parsed = aiJsonSettingsSchema.safeParse(body.jsonSettings);
      if (!parsed.success) {
        return NextResponse.json(
          {
            details: parsed.error.flatten(),
            error: "Invalid jsonSettings",
          },
          { status: 400 },
        );
      }
      jsonSettingsValue = parsed.data;
    }
  }

  await db
    .update(aiAgentTable)
    .set({
      backupMode:
        typeof backupMode === "string" ? backupMode : existing.backupMode,
      characterName:
        typeof body.characterName === "string" || body.characterName === null
          ? (body.characterName as null | string)
          : existing.characterName,
      characterSlug:
        typeof body.characterSlug === "string" || body.characterSlug === null
          ? (body.characterSlug as null | string)
          : existing.characterSlug,
      jsonSettings: jsonSettingsValue,
      localCacheEncrypted:
        typeof body.localCacheEncrypted === "boolean"
          ? body.localCacheEncrypted
          : existing.localCacheEncrypted,
      name:
        typeof body.name === "string" || body.name === null
          ? (body.name as null | string)
          : existing.name,
      updatedAt: new Date(),
      userPrompt:
        typeof body.userPrompt === "string" || body.userPrompt === null
          ? (body.userPrompt as null | string)
          : existing.userPrompt,
      userRagEnabled:
        typeof body.userRagEnabled === "boolean"
          ? body.userRagEnabled
          : existing.userRagEnabled,
      veniceApiKey:
        typeof body.veniceApiKey === "string" || body.veniceApiKey === null
          ? (body.veniceApiKey as null | string)
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
