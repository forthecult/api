import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { supportChatSettingTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";

const KEY_WIDGET_VISIBLE = "widget_visible";
const KEY_SUPPORT_AGENT_ENABLED = "support_agent_enabled";

/**
 * GET /api/admin/support-chat/widget-visible
 * Admin: returns widget visibility and whether Store support (Alice) is enabled.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const [rowVisible] = await db
      .select({ value: supportChatSettingTable.value })
      .from(supportChatSettingTable)
      .where(eq(supportChatSettingTable.key, KEY_WIDGET_VISIBLE))
      .limit(1);
    const [rowSupport] = await db
      .select({ value: supportChatSettingTable.value })
      .from(supportChatSettingTable)
      .where(eq(supportChatSettingTable.key, KEY_SUPPORT_AGENT_ENABLED))
      .limit(1);
    const visible = rowVisible?.value !== "false";
    const supportAgentEnabled =
      rowSupport?.value === undefined ? true : rowSupport.value !== "false";
    return NextResponse.json({ supportAgentEnabled, visible });
  } catch (err) {
    console.error("Admin support-chat widget-visible GET:", err);
    return NextResponse.json({ supportAgentEnabled: true, visible: true });
  }
}

/**
 * PATCH /api/admin/support-chat/widget-visible
 * Admin: set storefront widget and/or Store support (Alice).
 * Body: { visible?: boolean; supportAgentEnabled?: boolean }
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { supportAgentEnabled?: boolean; visible?: boolean };
    try {
      body = (await request.json()) as {
        supportAgentEnabled?: boolean;
        visible?: boolean;
      };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (typeof body.visible === "boolean") {
      await upsertSetting(KEY_WIDGET_VISIBLE, body.visible);
    }
    if (typeof body.supportAgentEnabled === "boolean") {
      await upsertSetting(KEY_SUPPORT_AGENT_ENABLED, body.supportAgentEnabled);
    }

    const [rowVisible] = await db
      .select({ value: supportChatSettingTable.value })
      .from(supportChatSettingTable)
      .where(eq(supportChatSettingTable.key, KEY_WIDGET_VISIBLE))
      .limit(1);
    const [rowSupport] = await db
      .select({ value: supportChatSettingTable.value })
      .from(supportChatSettingTable)
      .where(eq(supportChatSettingTable.key, KEY_SUPPORT_AGENT_ENABLED))
      .limit(1);

    const visible = rowVisible?.value !== "false";
    const supportAgentEnabled =
      rowSupport?.value === undefined ? true : rowSupport.value !== "false";

    revalidateTag("support-chat-widget-visible", "max");
    return NextResponse.json({ supportAgentEnabled, visible });
  } catch (err) {
    console.error("Admin support-chat widget-visible PATCH:", err);
    return NextResponse.json(
      { error: "Failed to update setting" },
      { status: 500 },
    );
  }
}

async function upsertSetting(key: string, visible: boolean) {
  const valueStr = visible ? "true" : "false";
  const [existing] = await db
    .select({ value: supportChatSettingTable.value })
    .from(supportChatSettingTable)
    .where(eq(supportChatSettingTable.key, key))
    .limit(1);

  if (existing) {
    await db
      .update(supportChatSettingTable)
      .set({ value: valueStr })
      .where(eq(supportChatSettingTable.key, key));
  } else {
    await db.insert(supportChatSettingTable).values({ key, value: valueStr });
  }
}
