import { inArray } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { supportChatSettingTable } from "~/db/schema";
import { getOrCreateAiAgent } from "~/lib/ai/user-agent";
import { auth } from "~/lib/auth";

const KEY_WIDGET_VISIBLE = "widget_visible";
const KEY_SUPPORT_AGENT_ENABLED = "support_agent_enabled";

const getCachedWidgetGlobals = unstable_cache(
  async () => {
    const rows = await db
      .select({
        key: supportChatSettingTable.key,
        value: supportChatSettingTable.value,
      })
      .from(supportChatSettingTable)
      .where(
        inArray(supportChatSettingTable.key, [
          KEY_WIDGET_VISIBLE,
          KEY_SUPPORT_AGENT_ENABLED,
        ]),
      );
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const globalVisible =
      KEY_WIDGET_VISIBLE in map ? map[KEY_WIDGET_VISIBLE] !== "false" : true;
    const supportAgent =
      KEY_SUPPORT_AGENT_ENABLED in map
        ? map[KEY_SUPPORT_AGENT_ENABLED] !== "false"
        : true;
    return { globalVisible, supportAgent };
  },
  ["support-chat-widget-globals"],
  { revalidate: 60, tags: ["support-chat-widget-visible"] },
);

/**
 * GET /api/support-chat/widget-visible
 * Public: returns whether the support chat widget is shown on the storefront,
 * whether Store support (Alice) is enabled, and whether Personal AI is shown
 * (admin global + per-user jsonSettings.personalAiWidgetEnabled).
 * Guests always get Personal AI unless the admin disables it globally.
 * Cached 60s for admin keys; user preference is resolved per request.
 */
export async function GET(request: Request) {
  try {
    const { globalVisible, supportAgent } = await getCachedWidgetGlobals();
    const session = await auth.api.getSession({ headers: request.headers });
    let personalAi = true;
    if (session?.user?.id) {
      const row = await getOrCreateAiAgent(session.user.id);
      const js = row.jsonSettings as null | Record<string, unknown>;
      if (js && typeof js.personalAiWidgetEnabled === "boolean") {
        personalAi = js.personalAiWidgetEnabled;
      }
    }
    const visible = globalVisible && (supportAgent || personalAi);
    return NextResponse.json({ personalAi, supportAgent, visible });
  } catch (err) {
    console.error("Support chat widget-visible GET:", err);
    return NextResponse.json({
      personalAi: true,
      supportAgent: true,
      visible: true,
    });
  }
}
