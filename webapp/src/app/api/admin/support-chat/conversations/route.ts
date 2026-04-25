import {
  and,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  or,
  sql,
} from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  supportChatConversationTable,
  supportChatMessageTable,
} from "~/db/schema";
import { userTable } from "~/db/schema/users/tables";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * GET /api/admin/support-chat/conversations
 * List all support chat conversations with customer summary (admin only).
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const page = Math.max(
      1,
      Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10),
    );
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        Number.parseInt(
          request.nextUrl.searchParams.get("limit") ??
            String(DEFAULT_PAGE_SIZE),
          10,
        ),
      ),
    );
    const offset = (page - 1) * limit;

    // Only show open conversations.
    // For guest conversations (no userId), only include if they have at least
    // one customer message — this avoids showing empty guest sessions.
    const activeFilter = and(
      eq(supportChatConversationTable.status, "open"),
      or(
        isNotNull(supportChatConversationTable.userId),
        exists(
          db
            .select({ one: sql`1` })
            .from(supportChatMessageTable)
            .where(
              and(
                eq(
                  supportChatMessageTable.conversationId,
                  supportChatConversationTable.id,
                ),
                eq(supportChatMessageTable.role, "customer"),
              ),
            ),
        ),
      ),
    );

    const conversations = await db
      .select({
        createdAt: supportChatConversationTable.createdAt,
        guestId: supportChatConversationTable.guestId,
        id: supportChatConversationTable.id,
        source: supportChatConversationTable.source,
        status: supportChatConversationTable.status,
        takenOverBy: supportChatConversationTable.takenOverBy,
        updatedAt: supportChatConversationTable.updatedAt,
        userEmail: userTable.email,
        userId: supportChatConversationTable.userId,
        userName: userTable.name,
      })
      .from(supportChatConversationTable)
      .leftJoin(
        userTable,
        eq(supportChatConversationTable.userId, userTable.id),
      )
      .where(activeFilter)
      .orderBy(desc(supportChatConversationTable.updatedAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(supportChatConversationTable)
      .where(activeFilter);

    const total = countResult?.count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const convIds = conversations.map((c) => c.id);
    const latestMessages =
      convIds.length > 0
        ? await db
            .select({
              conversationId: supportChatMessageTable.conversationId,
              createdAt: supportChatMessageTable.createdAt,
              role: supportChatMessageTable.role,
            })
            .from(supportChatMessageTable)
            .where(inArray(supportChatMessageTable.conversationId, convIds))
            .orderBy(
              supportChatMessageTable.conversationId,
              desc(supportChatMessageTable.createdAt),
            )
        : [];

    const latestByConv = new Map<string, { createdAt: Date; role: string }>();
    for (const m of latestMessages) {
      if (!latestByConv.has(m.conversationId)) {
        latestByConv.set(m.conversationId, {
          createdAt: m.createdAt,
          role: m.role,
        });
      }
    }

    const items = conversations.map((c) => {
      const last = latestByConv.get(c.id);
      return {
        createdAt: c.createdAt,
        customer: c.userId
          ? { email: c.userEmail ?? "", id: c.userId, name: c.userName ?? "" }
          : { email: null, id: null, name: "Guest" },
        guestId: c.guestId ?? undefined,
        id: c.id,
        lastMessageAt: last?.createdAt?.toISOString() ?? null,
        lastMessageRole: last?.role ?? null,
        source: c.source,
        status: c.status,
        takenOverBy: c.takenOverBy ?? undefined,
        updatedAt: c.updatedAt,
      };
    });

    return NextResponse.json({
      items,
      limit,
      page,
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
