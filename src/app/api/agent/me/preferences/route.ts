import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { agentPreferencesTable } from "~/db/schema";
import { getMoltbookAgentFromRequest } from "~/lib/moltbook-auth";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

/**
 * GET /api/agent/me/preferences
 *
 * Returns key-value preferences for the authenticated Moltbook agent.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(
    `agent:me/preferences:${ip}`,
    RATE_LIMITS.api,
  );
  if (!rl.success) return rateLimitResponse(rl, RATE_LIMITS.api.limit);

  const result = await getMoltbookAgentFromRequest(request);
  if ("error" in result) return result.error;

  const rows = await db
    .select({
      key: agentPreferencesTable.key,
      value: agentPreferencesTable.value,
    })
    .from(agentPreferencesTable)
    .where(eq(agentPreferencesTable.moltbookAgentId, result.agent.id));

  const preferences: Record<string, string> = {};
  for (const row of rows) {
    preferences[row.key] = row.value;
  }

  return NextResponse.json(
    {
      agent: { id: result.agent.id, name: result.agent.name },
      preferences,
    },
    { headers: getRateLimitHeaders(rl, RATE_LIMITS.api.limit) },
  );
}

/**
 * PATCH /api/agent/me/preferences
 *
 * Body: { preferences: Record<string, string> }
 * Upserts the given keys for the authenticated agent. Values must be strings.
 * To remove a key, set it to empty string or omit and delete via separate convention if needed.
 */
export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(
    `agent:me/preferences:${ip}`,
    RATE_LIMITS.api,
  );
  if (!rl.success) return rateLimitResponse(rl, RATE_LIMITS.api.limit);

  const result = await getMoltbookAgentFromRequest(request);
  if ("error" in result) return result.error;

  let body: { preferences?: Record<string, unknown> };
  try {
    body = (await request.json()) as { preferences?: Record<string, unknown> };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON or missing body" },
      { status: 400 },
    );
  }

  const raw = body.preferences;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json(
      { error: "Body must include preferences object" },
      { status: 400 },
    );
  }

  const agentId = result.agent.id;
  const now = new Date();

  for (const [key, val] of Object.entries(raw)) {
    if (typeof key !== "string" || key.trim() === "") continue;
    const value =
      typeof val === "string" ? val : val == null ? "" : String(val);
    await db
      .insert(agentPreferencesTable)
      .values({
        moltbookAgentId: agentId,
        key: key.trim(),
        value,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          agentPreferencesTable.moltbookAgentId,
          agentPreferencesTable.key,
        ],
        set: { value, updatedAt: now },
      });
  }

  const rows = await db
    .select({
      key: agentPreferencesTable.key,
      value: agentPreferencesTable.value,
    })
    .from(agentPreferencesTable)
    .where(eq(agentPreferencesTable.moltbookAgentId, agentId));

  const preferences: Record<string, string> = {};
  for (const row of rows) {
    preferences[row.key] = row.value;
  }

  return NextResponse.json(
    {
      ok: true,
      agent: { id: result.agent.id, name: result.agent.name },
      preferences,
    },
    { headers: getRateLimitHeaders(rl, RATE_LIMITS.api.limit) },
  );
}
