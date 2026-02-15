import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { twoFactorTable, userTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

/**
 * POST /api/admin/customers/[id]/disable-2fa
 * Admin-only. Disables two-factor authentication for the customer (clears 2FA secret and sets twoFactorEnabled = false).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;
    const [user] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.id, id))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    await db.delete(twoFactorTable).where(eq(twoFactorTable.userId, id));

    await db
      .update(userTable)
      .set({ twoFactorEnabled: false, updatedAt: new Date() })
      .where(eq(userTable.id, id));

    console.info(`[admin-audit] 2FA disabled for user ${id} via admin API`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin customer disable-2fa error:", err);
    return NextResponse.json(
      { error: "Failed to disable 2FA" },
      { status: 500 },
    );
  }
}
