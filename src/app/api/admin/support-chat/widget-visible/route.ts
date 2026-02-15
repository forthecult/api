import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { supportChatSettingTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";

const KEY_WIDGET_VISIBLE = "widget_visible";

/**
 * GET /api/admin/support-chat/widget-visible
 * Admin: returns current widget visibility setting.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const [row] = await db
      .select({ value: supportChatSettingTable.value })
      .from(supportChatSettingTable)
      .where(eq(supportChatSettingTable.key, KEY_WIDGET_VISIBLE))
      .limit(1);
    const visible = row?.value !== "false";
    return NextResponse.json({ visible });
  } catch (err) {
    console.error("Admin support-chat widget-visible GET:", err);
    return NextResponse.json({ visible: true });
  }
}

/**
 * PATCH /api/admin/support-chat/widget-visible
 * Admin: set whether the support chat widget is shown on the storefront.
 * Body: { visible: boolean }
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { visible?: boolean };
    try {
      body = (await request.json()) as { visible?: boolean };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const visible = body.visible !== false;
    const valueStr = visible ? "true" : "false";

    const [existing] = await db
      .select({ value: supportChatSettingTable.value })
      .from(supportChatSettingTable)
      .where(eq(supportChatSettingTable.key, KEY_WIDGET_VISIBLE))
      .limit(1);

    if (existing) {
      await db
        .update(supportChatSettingTable)
        .set({ value: valueStr })
        .where(eq(supportChatSettingTable.key, KEY_WIDGET_VISIBLE));
    } else {
      await db.insert(supportChatSettingTable).values({
        key: KEY_WIDGET_VISIBLE,
        value: valueStr,
      });
    }

    revalidateTag("support-chat-widget-visible", "max");
    return NextResponse.json({ visible });
  } catch (err) {
    console.error("Admin support-chat widget-visible PATCH:", err);
    return NextResponse.json(
      { error: "Failed to update setting" },
      { status: 500 },
    );
  }
}
