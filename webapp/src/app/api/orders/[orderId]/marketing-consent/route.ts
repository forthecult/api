import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { userTable } from "~/db/schema/users/tables";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

/**
 * POST /api/orders/{orderId}/marketing-consent
 * Body: { email: string, emailConsent?: boolean, smsConsent?: boolean, phone?: string }
 *
 * Saves marketing preferences for the customer.
 * - Email is required to verify ownership of the order.
 * - If the order has a userId, updates the user's marketing preferences.
 * - If a phone number is provided (for SMS consent), updates the order's shipping phone.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`marketing-consent:${ip}`, RATE_LIMITS.api);
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const { orderId } = await params;
    if (!orderId?.trim()) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const body = (await request.json()) as {
      email?: string;
      emailConsent?: boolean;
      phone?: string;
      smsConsent?: boolean;
    };

    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    // Fetch order and verify email matches
    const [order] = await db
      .select({
        email: ordersTable.email,
        id: ordersTable.id,
        userId: ordersTable.userId,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId.trim()))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verify email ownership
    if (order.email.trim().toLowerCase() !== email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const now = new Date();

    // Update order phone if provided
    if (body.phone?.trim()) {
      await db
        .update(ordersTable)
        .set({ shippingPhone: body.phone.trim(), updatedAt: now })
        .where(eq(ordersTable.id, order.id));
    }

    // If the order has a userId, update user marketing preferences
    if (order.userId) {
      const userUpdates: Record<string, boolean | Date> = { updatedAt: now };
      if (typeof body.emailConsent === "boolean") {
        userUpdates.receiveMarketing = body.emailConsent;
        userUpdates.marketingEmail = body.emailConsent;
      }
      if (typeof body.smsConsent === "boolean") {
        userUpdates.receiveSmsMarketing = body.smsConsent;
        userUpdates.marketingSms = body.smsConsent;
      }
      if (Object.keys(userUpdates).length > 1) {
        await db
          .update(userTable)
          .set(userUpdates)
          .where(eq(userTable.id, order.userId));
      }
    }

    return NextResponse.json({ saved: true });
  } catch (err) {
    console.error("Marketing consent error:", err);
    return NextResponse.json(
      { error: "Failed to save preferences" },
      { status: 500 },
    );
  }
}
