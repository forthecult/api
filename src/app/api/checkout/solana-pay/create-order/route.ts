import { createId } from "@paralleldrive/cuid2";
import { type NextRequest, NextResponse } from "next/server";

import { deriveDepositAddress } from "~/lib/solana-deposit";
import { auth } from "~/lib/auth";
import {
  buildOrderErrorMessage,
  insertOrder,
  insertOrderItems,
  postOrderBookkeeping,
  resolveDiscounts,
  validateAndFetchProducts,
  validateTotal,
} from "~/lib/checkout/create-order-helpers";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";
import { createOrderSchema, validateBody } from "~/lib/validations/checkout";

export async function POST(request: NextRequest) {
  // Rate limit checkout to prevent order spam
  const ip = getClientIp(request.headers);
  const rateLimitResult = checkRateLimit(
    `checkout:${ip}`,
    RATE_LIMITS.checkout,
  );
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  if (!process.env.SOLANA_DEPOSIT_SECRET?.trim()) {
    return NextResponse.json(
      { error: "Solana Pay is not configured (SOLANA_DEPOSIT_SECRET)." },
      { status: 503 },
    );
  }

  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const rawBody = await request.json();

    // Validate input with Zod
    const validation = validateBody(createOrderSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const {
      reference,
      email,
      orderItems: rawItems,
      totalCents,
      shippingFeeCents = 0,
      taxCents = 0,
      emailMarketingConsent,
      smsMarketingConsent,
      telegramUserId,
      telegramUsername,
      telegramFirstName,
      affiliateCode,
      couponCode,
      token: tokenFromBody,
    } = validation.data;

    // Map frontend token to stored crypto currency (for balance check / UI on payment page)
    const SOLANA_TOKEN_TO_CURRENCY: Record<string, string> = {
      solana: "SOL",
      usdc: "USDC",
      whitewhale: "WHITEWHALE",
      crust: "CRUST",
      pump: "PUMP",
      troll: "TROLL",
    };
    const cryptoCurrency =
      tokenFromBody && SOLANA_TOKEN_TO_CURRENCY[tokenFromBody]
        ? SOLANA_TOKEN_TO_CURRENCY[tokenFromBody]
        : null;

    // ── Validate products & compute subtotal ───────────────────────────
    const productResult = await validateAndFetchProducts(rawItems);
    if (!productResult) {
      return NextResponse.json(
        { error: "No valid order items" },
        { status: 400 },
      );
    }
    const { validatedItems, productIds, subtotalCents } = productResult;

    // ── Resolve discounts ──────────────────────────────────────────────
    const { affiliateResult, couponResult, expectedTotal } =
      await resolveDiscounts({
        affiliateCode,
        couponCode,
        subtotalCents,
        shippingFeeCents,
        userId: session?.user?.id,
        productIds,
      });

    // ── Validate client total ──────────────────────────────────────────
    const totalCheck = validateTotal({
      clientTotalCents: totalCents,
      expectedTotal,
      extraCents: taxCents,
    });
    if (!totalCheck.valid) {
      return NextResponse.json(
        {
          error:
            "Order total does not match. Cart may have changed — refresh the page and try again.",
        },
        { status: 400 },
      );
    }

    // ── Payment-method-specific: Solana deposit address ────────────────
    const orderId = createId();
    const userIdVal =
      session?.user?.id && validation.data.userId === session.user.id
        ? session.user.id
        : null;
    const depositAddress = deriveDepositAddress(orderId);

    // ── Insert order ───────────────────────────────────────────────────
    await insertOrder(
      {
        orderId,
        email,
        paymentMethod: "solana_pay",
        totalCents: totalCheck.expectedTotal,
        shippingFeeCents,
        taxCents,
        userId: userIdVal,
        reference,
        telegramUserId,
        telegramUsername,
        telegramFirstName,
        affiliateResult,
      },
      {
        solanaPayDepositAddress: depositAddress,
        ...(reference && typeof reference === "string" && reference.trim()
          ? { solanaPayReference: reference.trim() }
          : {}),
        ...(cryptoCurrency ? { cryptoCurrency } : {}),
      },
    );

    // ── Insert order items ─────────────────────────────────────────────
    await insertOrderItems(validatedItems, orderId);

    // ── Post-order bookkeeping ─────────────────────────────────────────
    await postOrderBookkeeping({
      orderId,
      userId: userIdVal,
      affiliateResult,
      couponResult,
      emailMarketingConsent,
      smsMarketingConsent,
    });

    return NextResponse.json({
      orderId,
      depositAddress,
      status: "awaiting_payment",
      _actions: {
        next: `Poll GET /api/orders/${orderId}/status every 5s until status changes`,
        cancel: `POST /api/orders/${orderId}/cancel (only before payment)`,
        help: "Contact support@forthecut.store",
      },
    });
  } catch (err) {
    console.error("Solana Pay create-order error:", err);
    return NextResponse.json(
      { error: buildOrderErrorMessage(err) },
      { status: 500 },
    );
  }
}
