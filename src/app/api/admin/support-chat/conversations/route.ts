import { desc, eq, inArray, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  supportChatConversationTable,
  supportChatMessageTable,
} from "~/db/schema";
import { userTable } from "~/db/schema/users/tables";
import { getAdminAuth } from "~/lib/admin-api-auth";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * GET /api/admin/support-chat/conversations
 * List all support chat conversations with customer summary (admin only).
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const page = Math.max(
      1,
      Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10),
    );
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        Number.parseInt(
          request.nextUrl.searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE),
          10,
        ),
      ),
    );
    const offset = (page - 1) * limit;

    const conversations = await db
      .select({
        id: supportChatConversationTable.id,
        userId: supportChatConversationTable.userId,
        guestId: supportChatConversationTable.guestId,
        status: supportChatConversationTable.status,
        takenOverBy: supportChatConversationTable.takenOverBy,
        createdAt: supportChatConversationTable.createdAt,
        updatedAt: supportChatConversationTable.updatedAt,
        userName: userTable.name,
        userEmail: userTable.email,
      })
      .from(supportChatConversationTable)
      .leftJoin(userTable, eq(supportChatConversationTable.userId, userTable.id))
      .orderBy(desc(supportChatConversationTable.updatedAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(supportChatConversationTable);

    const total = countResult?.count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const convIds = conversations.map((c) => c.id);
    const latestMessages =
      convIds.length > 0
        ? await db
            .select({
              conversationId: supportChatMessageTable.conversationId,
              role: supportChatMessageTable.role,
              createdAt: supportChatMessageTable.createdAt,
            })
            .from(supportChatMessageTable)
            .where(
              inArray(
                supportChatMessageTable.conversationId,
                convIds,
              ),
            )
            .orderBy(
              supportChatMessageTable.conversationId,
              desc(supportChatMessageTable.createdAt),
            )
        : [];

    const latestByConv = new Map<
      string,
      { role: string; createdAt: Date }
    >();
    for (const m of latestMessages) {
      if (!latestByConv.has(m.conversationId)) {
        latestByConv.set(m.conversationId, {
          role: m.role,
          createdAt: m.createdAt,
        });
      }
    }

    const items = conversations.map((c) => {
      const last = latestByConv.get(c.id);
      return {
        id: c.id,
        status: c.status,
        takenOverBy: c.takenOverBy ?? undefined,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        lastMessageRole: last?.role ?? null,
        lastMessageAt: last?.createdAt?.toISOString() ?? null,
        customer: c.userId
          ? { id: c.userId, name: c.userName ?? "", email: c.userEmail ?? "" }
          : { id: null, name: "Guest", email: null },
        guestId: c.guestId ?? undefined,
      };
    });

    return NextResponse.json({
      items,
      page,
      limit,
      totalCount: total,
      totalPages,
    });
  } catch (err) {
    console.error("Admin support-chat conversations GET:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
