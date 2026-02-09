import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { userTable } from "~/db/schema/users/tables";
import { getAdminAuth } from "~/lib/admin-api-auth";

const MAIN_APP_BASE =
  process.env.NEXT_SERVER_APP_URL ||
  (typeof process.env.VERCEL_URL === "string"
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));

/**
 * POST /api/admin/customers/[id]/reset-password
 * Admin-only. Sends a password reset email to the customer. Admin cannot set or see the password.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const [user] = await db
      .select({ id: userTable.id, email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, id))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    const email = user.email?.trim();
    if (!email) {
      return NextResponse.json(
        { error: "Customer has no email address" },
        { status: 400 },
      );
    }

    const redirectTo = `${MAIN_APP_BASE}/auth/reset-password`;
    const res = await fetch(
      `${MAIN_APP_BASE}/api/auth/request-password-reset`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectTo }),
      },
    );

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      console.error("[admin reset-password] Auth API error:", res.status, body);
      return NextResponse.json(
        { error: body.message ?? "Failed to send reset email" },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin customer reset-password error:", err);
    return NextResponse.json(
      { error: "Failed to send reset email" },
      { status: 500 },
    );
  }
}
