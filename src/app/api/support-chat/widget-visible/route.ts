import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { supportChatSettingTable } from "~/db/schema";

const KEY_WIDGET_VISIBLE = "widget_visible";

/** Cached 60s to avoid exhausting DB connection pool (e.g. PgBouncer session mode). */
const getCachedWidgetVisible = unstable_cache(
  async () => {
    const [row] = await db
      .select({ value: supportChatSettingTable.value })
      .from(supportChatSettingTable)
      .where(eq(supportChatSettingTable.key, KEY_WIDGET_VISIBLE))
      .limit(1);
    return row?.value !== "false";
  },
  ["support-chat-widget-visible"],
  { revalidate: 60, tags: ["support-chat-widget-visible"] },
);

/**
 * GET /api/support-chat/widget-visible
 * Public: returns whether the support chat widget is shown on the storefront.
 * Defaults to true if not set. Cached 60s to reduce DB load.
 */
export async function GET() {
  try {
    const visible = await getCachedWidgetVisible();
    return NextResponse.json({ visible });
  } catch (err) {
    console.error("Support chat widget-visible GET:", err);
    return NextResponse.json({ visible: true });
  }
}
