import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { supportChatSettingTable } from "~/db/schema";

const KEY_WIDGET_VISIBLE = "widget_visible";

/**
 * GET /api/support-chat/widget-visible
 * Public: returns whether the support chat widget is shown on the storefront.
 * Defaults to true if not set.
 */
export async function GET() {
  try {
    const [row] = await db
      .select({ value: supportChatSettingTable.value })
      .from(supportChatSettingTable)
      .where(eq(supportChatSettingTable.key, KEY_WIDGET_VISIBLE))
      .limit(1);

    const visible = row?.value !== "false";
    return NextResponse.json({ visible });
  } catch (err) {
    console.error("Support chat widget-visible GET:", err);
    return NextResponse.json({ visible: true });
  }
}
