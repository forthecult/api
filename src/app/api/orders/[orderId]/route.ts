import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { orderItemsTable, ordersTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";
import { auth } from "~/lib/auth";
import { verifyOrderConfirmationToken } from "~/lib/order-confirmation-token";

const PAYMENT_WINDOW_MS = 60 * 60 * 1000;

type AccessLevel = "admin" | "first_visit" | "owner" | "public";

/**
 * Full order details: items, shipping, totals, payment summary.
 * GET /api/orders/{orderId}?ct=<confirmationToken>
 *
 * Access levels:
 * - admin: full data
 * - owner (authenticated, email or userId match): full data
 * - first_visit (valid confirmation token + order < 1 hour old): full data
 * - public: redacted PII (email, shipping address hidden)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    if (!orderId?.trim()) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const [order] = await db
      .select({
        createdAt: ordersTable.createdAt,
        cryptoCurrency: ordersTable.cryptoCurrency,
        email: ordersTable.email,
        id: ordersTable.id,
        payerWalletAddress: ordersTable.payerWalletAddress,
        paymentMethod: ordersTable.paymentMethod,
        shippingAddress1: ordersTable.shippingAddress1,
        shippingAddress2: ordersTable.shippingAddress2,
        shippingCity: ordersTable.shippingCity,
        shippingCountryCode: ordersTable.shippingCountryCode,
        shippingFeeCents: ordersTable.shippingFeeCents,
        shippingName: ordersTable.shippingName,
        shippingPhone: ordersTable.shippingPhone,
        shippingStateCode: ordersTable.shippingStateCode,
        shippingZip: ordersTable.shippingZip,
        solanaPayDepositAddress: ordersTable.solanaPayDepositAddress,
        status: ordersTable.status,
        totalCents: ordersTable.totalCents,
        updatedAt: ordersTable.updatedAt,
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

    // ── Determine access level ──────────────────────────────────────────
    let accessLevel: AccessLevel = "public";
    const orderAgeMs = Date.now() - order.createdAt.getTime();
    const isRecentOrder = orderAgeMs < PAYMENT_WINDOW_MS;

    // Admin check
    const adminAuth = await getAdminAuth(request);
    if (adminAuth?.ok) {
      accessLevel = "admin";
    }

    // Owner check (authenticated user with matching email, userId, or wallet)
    if (accessLevel === "public") {
      const session = await auth.api.getSession({ headers: request.headers });
      if (session?.user) {
        const emailVerified = (session.user as { emailVerified?: boolean })
          ?.emailVerified;
        const isOwnerByUserId = order.userId === session.user.id;
        const isOwnerByEmail =
          emailVerified &&
          normalizeEmail(order.email) === normalizeEmail(session.user.email);
        // Check wallet address match (user may have linked wallet)
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

    // First visit check (valid confirmation token + recent order)
    if (accessLevel === "public" && isRecentOrder) {
      const ct = request.nextUrl.searchParams.get("ct");
      if (verifyOrderConfirmationToken(order.id, ct)) {
        accessLevel = "first_visit";
      }
    }

    // For public access to non-recent orders, deny entirely
    if (accessLevel === "public" && !isRecentOrder) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Not authorized to view this order",
          },
        },
        { status: 401 },
      );
    }

    // ── Build response ──────────────────────────────────────────────────
    const canSeePII = accessLevel !== "public";

    const statusMap: Record<string, string> = {
      cancelled: "cancelled",
      fulfilled: "shipped",
      paid: "paid",
      pending: "awaiting_payment",
    };
    let status = statusMap[order.status] ?? order.status;
    if (order.status === "pending") {
      const expiresAt = order.createdAt.getTime() + PAYMENT_WINDOW_MS;
      if (Date.now() > expiresAt) status = "expired";
    }

    const items = await db
      .select({
        name: orderItemsTable.name,
        priceCents: orderItemsTable.priceCents,
        productId: orderItemsTable.productId,
        quantity: orderItemsTable.quantity,
      })
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, order.id));

    const subtotalCents = items.reduce(
      (sum, i) => sum + i.priceCents * i.quantity,
      0,
    );
    const shippingUsd = (order.shippingFeeCents ?? 0) / 100;
    const subtotalUsd = subtotalCents / 100;
    const totalUsd = order.totalCents / 100;

    const paidAt =
      order.status === "paid" ? order.updatedAt.toISOString() : null;

    // Build shipping object — full or redacted
    const hasShipping =
      order.shippingName ||
      order.shippingAddress1 ||
      order.shippingCity ||
      order.shippingCountryCode;
    const shipping = hasShipping
      ? canSeePII
        ? {
            address1: order.shippingAddress1 ?? undefined,
            address2: order.shippingAddress2 ?? undefined,
            city: order.shippingCity ?? undefined,
            countryCode: order.shippingCountryCode ?? undefined,
            name: order.shippingName ?? undefined,
            phone: order.shippingPhone ?? undefined,
            stateCode: order.shippingStateCode ?? undefined,
            zip: order.shippingZip ?? undefined,
          }
        : {
            // Redacted: only expose country for delivery estimate, nothing else
            countryCode: order.shippingCountryCode ?? undefined,
          }
      : undefined;

    return NextResponse.json({
      _actions: {
        ...(status === "awaiting_payment" && {
          cancel: `POST /api/orders/${order.id}/cancel (only before payment)`,
          next: `Poll GET /api/orders/${order.id}/status every 5s until status changes`,
        }),
        help: "Contact support@forthecult.store",
      },
      accessLevel,
      createdAt: order.createdAt.toISOString(),
      cryptoCurrency: order.cryptoCurrency ?? undefined,
      email: canSeePII
        ? (order.email ?? undefined)
        : order.email
          ? redactEmail(order.email)
          : undefined,
      items: items.map((i) => ({
        name: i.name,
        priceUsd: i.priceCents / 100,
        productId: i.productId,
        quantity: i.quantity,
        subtotalUsd: (i.priceCents * i.quantity) / 100,
      })),
      orderId: order.id,
      paidAt,
      payment: order.solanaPayDepositAddress
        ? {
            amountUsd: totalUsd,
            chain: "solana",
            token: "USDC",
            transactionSignature: undefined,
          }
        : undefined,
      paymentMethod: order.paymentMethod ?? undefined,
      shipping,
      status,
      totals: {
        shippingUsd,
        subtotalUsd,
        totalUsd,
      },
    });
  } catch (err) {
    console.error("Order details error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load order" } },
      { status: 500 },
    );
  }
}

/** Normalize email for ownership check (lowercase, trim). */
function normalizeEmail(email: null | string | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** Redact email: "user@example.com" → "u***@e***.com" */
function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***.***";
  const domainParts = domain.split(".");
  const domainName = domainParts[0] ?? "";
  const tld = domainParts.slice(1).join(".");
  return `${local[0]}***@${domainName[0]}***.${tld}`;
}
