import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { orderItemsTable, ordersTable } from "~/db/schema";
import { auth } from "~/lib/auth";
import { verifyOrderConfirmationToken } from "~/lib/order-confirmation-token";

type AccessLevel = "first_visit" | "owner" | "public";

/**
 * GET /api/orders/by-session?session_id=xxx&ct=<confirmationToken>
 * Returns order details for the thank-you page when redirect has session_id (Stripe).
 *
 * Access levels:
 * - owner (authenticated, email match): full data
 * - first_visit (valid confirmation token derived from session_id): full data
 * - public: redacted PII
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  const [order] = await db
    .select({
      createdAt: ordersTable.createdAt,
      cryptoCurrency: ordersTable.cryptoCurrency,
      email: ordersTable.email,
      id: ordersTable.id,
      paymentMethod: ordersTable.paymentMethod,
      shippingAddress1: ordersTable.shippingAddress1,
      shippingAddress2: ordersTable.shippingAddress2,
      shippingCity: ordersTable.shippingCity,
      shippingCountryCode: ordersTable.shippingCountryCode,
      shippingName: ordersTable.shippingName,
      shippingPhone: ordersTable.shippingPhone,
      shippingStateCode: ordersTable.shippingStateCode,
      shippingZip: ordersTable.shippingZip,
      totalCents: ordersTable.totalCents,
      userId: ordersTable.userId,
    })
    .from(ordersTable)
    .where(eq(ordersTable.stripeCheckoutSessionId, sessionId))
    .limit(1);

  if (!order) {
    return NextResponse.json(
      { error: "Order not found or not yet created" },
      { status: 404 },
    );
  }

  // ── Determine access level ──────────────────────────────────────────
  let accessLevel: AccessLevel = "public";

  // Owner check
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user) {
    const emailVerified = (session.user as { emailVerified?: boolean })
      ?.emailVerified;
    const isOwnerByUserId = order.userId === session.user.id;
    const isOwnerByEmail =
      emailVerified &&
      normalizeEmail(order.email) === normalizeEmail(session.user.email);
    if (isOwnerByUserId || isOwnerByEmail) {
      accessLevel = "owner";
    }
  }

  // First visit check (confirmation token derived from sessionId)
  if (accessLevel === "public") {
    const ct = request.nextUrl.searchParams.get("ct");
    if (verifyOrderConfirmationToken(sessionId, ct)) {
      accessLevel = "first_visit";
    }
  }

  const canSeePII = accessLevel !== "public";

  const items = await db
    .select({
      name: orderItemsTable.name,
      priceCents: orderItemsTable.priceCents,
      quantity: orderItemsTable.quantity,
    })
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  // Build shipping — full or redacted
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
          countryCode: order.shippingCountryCode ?? undefined,
        }
    : undefined;

  return NextResponse.json({
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
      quantity: i.quantity,
      subtotalUsd: (i.priceCents * i.quantity) / 100,
    })),
    orderId: order.id,
    paymentMethod: order.paymentMethod ?? "stripe",
    shipping,
    totalCents: order.totalCents,
  });
}

/** Normalize email for ownership check. */
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
