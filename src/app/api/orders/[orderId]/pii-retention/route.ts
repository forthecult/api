import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";
import { auth } from "~/lib/auth";
import { verifyOrderConfirmationToken } from "~/lib/order-confirmation-token";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

const PAYMENT_WINDOW_MS = 60 * 60 * 1000;

type AccessLevel = "admin" | "first_visit" | "owner" | "public";

/**
 * PATCH /api/orders/{orderId}/pii-retention
 * Body: { requestDeletion?: boolean, ct?: string | null }
 *
 * When `requestDeletion` is true, records the customer's request to purge
 * shipping/contact fields from this order after delivery + 60 days.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`order-pii-retention:${ip}`, RATE_LIMITS.api);
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const { orderId } = await params;
    if (!orderId?.trim()) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const body = (await request.json()) as {
      ct?: null | string;
      requestDeletion?: boolean;
    };

    if (body.requestDeletion !== true) {
      return NextResponse.json(
        { error: "requestDeletion must be true" },
        { status: 400 },
      );
    }

    const [order] = await db
      .select({
        createdAt: ordersTable.createdAt,
        email: ordersTable.email,
        id: ordersTable.id,
        payerWalletAddress: ordersTable.payerWalletAddress,
        piiDeletionRequestedAt: ordersTable.piiDeletionRequestedAt,
        userId: ordersTable.userId,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId.trim()))
      .limit(1);

    if (!order) {
      return NextResponse.json(
        { error: { code: "ORDER_NOT_FOUND", message: "Order not found" } },
        { status: 404 },
      );
    }

    let accessLevel: AccessLevel = "public";
    const orderAgeMs = Date.now() - order.createdAt.getTime();
    const isRecentOrder = orderAgeMs < PAYMENT_WINDOW_MS;

    const adminAuth = await getAdminAuth(request);
    if (adminAuth?.ok) {
      accessLevel = "admin";
    }

    if (accessLevel === "public") {
      const session = await auth.api.getSession({ headers: request.headers });
      if (session?.user) {
        const emailVerified = (session.user as { emailVerified?: boolean })
          ?.emailVerified;
        const isOwnerByUserId = order.userId === session.user.id;
        const isOwnerByEmail =
          emailVerified &&
          normalizeEmail(order.email) === normalizeEmail(session.user.email);
        const userWalletAddress = (session.user as { walletAddress?: string })
          ?.walletAddress;
        const isOwnerByWallet =
          userWalletAddress &&
          order.payerWalletAddress &&
          userWalletAddress.toLowerCase() ===
            order.payerWalletAddress.toLowerCase();

        if (isOwnerByUserId || isOwnerByEmail || isOwnerByWallet) {
          accessLevel = "owner";
        }
      }
    }

    if (accessLevel === "public" && isRecentOrder) {
      const ct = body.ct?.trim() || request.nextUrl.searchParams.get("ct");
      if (verifyOrderConfirmationToken(order.id, ct)) {
        accessLevel = "first_visit";
      }
    }

    const canMutate =
      accessLevel === "admin" ||
      accessLevel === "owner" ||
      accessLevel === "first_visit";

    if (!canMutate) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Not authorized to update this order",
          },
        },
        { status: 401 },
      );
    }

    const now = new Date();
    if (order.piiDeletionRequestedAt) {
      return NextResponse.json({
        alreadyRequested: true,
        piiDeletionRequestedAt: order.piiDeletionRequestedAt.toISOString(),
      });
    }

    await db
      .update(ordersTable)
      .set({
        piiDeletionRequestedAt: now,
        updatedAt: now,
      })
      .where(eq(ordersTable.id, order.id));

    return NextResponse.json({
      piiDeletionRequestedAt: now.toISOString(),
      saved: true,
    });
  } catch (err) {
    console.error("Order PII retention error:", err);
    return NextResponse.json(
      {
        error: { code: "INTERNAL_ERROR", message: "Failed to save preference" },
      },
      { status: 500 },
    );
  }
}

function normalizeEmail(email: null | string | undefined): string {
  return (email ?? "").trim().toLowerCase();
}
