import { createId } from "@paralleldrive/cuid2";
import { type NextRequest, NextResponse } from "next/server";

import { auth } from "~/lib/auth";
import {
  buildOrderErrorMessage,
  createEsimOrderRecordsForOrder,
  insertOrder,
  insertOrderItems,
  postOrderBookkeeping,
  resolveDiscounts,
  validateAndFetchProducts,
  validateTotal,
} from "~/lib/checkout/create-order-helpers";
import { generateOrderConfirmationToken } from "~/lib/order-confirmation-token";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";
import { deriveDepositAddress } from "~/lib/solana-deposit";
import { createOrderSchema, validateBody } from "~/lib/validations/checkout";

export async function POST(request: NextRequest) {
  // Rate limit checkout to prevent order spam
  const ip = getClientIp(request.headers);
  const rateLimitResult = await checkRateLimit(
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
      affiliateCode,
      couponCode,
      email,
      emailMarketingConsent,
      orderItems: rawItems,
      reference,
      shipping,
      shippingFeeCents = 0,
      smsMarketingConsent,
      taxCents = 0,
      telegramFirstName,
      telegramUserId,
      telegramUsername,
      token: tokenFromBody,
      totalCents,
      wallet,
    } = validation.data;

    // Map frontend token to stored crypto currency (for balance check / UI on payment page)
    const SOLANA_TOKEN_TO_CURRENCY: Record<string, string> = {
      crust: "CRUST",
      cult: "CULT",
      pump: "PUMP",
      seeker: "SKR",
      solana: "SOL",
      soluna: "SOLUNA",
      troll: "TROLL",
      usdc: "USDC",
      whitewhale: "WHITEWHALE",
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
    const { productIds, subtotalCents, validatedItems } = productResult;

    // ── Resolve discounts ──────────────────────────────────────────────
    const TOKEN_TO_PAYMENT_METHOD_KEY: Record<string, null | string> = {
      crust: "crypto_crust",
      cult: "crypto_cult",
      pump: "crypto_pump",
      seeker: "crypto_seeker",
      solana: "crypto_solana",
      soluna: "crypto_soluna",
      troll: "crypto_troll",
      usdc: "stablecoin_usdc",
      whitewhale: null,
    };
    const paymentMethodKey =
      tokenFromBody && TOKEN_TO_PAYMENT_METHOD_KEY[tokenFromBody]
        ? TOKEN_TO_PAYMENT_METHOD_KEY[tokenFromBody]
        : null;

    const { affiliateResult, couponResult, expectedTotal } =
      await resolveDiscounts({
        affiliateCode,
        clientTotalCents: totalCents,
        couponCode,
        items: validatedItems.map((i) => ({
          priceCents: i.priceCents,
          productId: i.productId,
          quantity: i.quantity,
        })),
        paymentMethodKey,
        productIds,
        shippingFeeCents,
        subtotalCents,
        userId: session?.user?.id,
        wallet: wallet ?? undefined,
      });

    // ── Validate client total (server is source of truth) ───────────────
    const totalCheck = validateTotal({
      clientTotalCents: totalCents,
      expectedTotal,
      extraCents: taxCents,
    });
    // Reject only when client sent less than server total (undercharge/tampering).
    // When client sent same or more (e.g. race: UI not yet updated), accept and use server total.
    if (!totalCheck.valid && totalCents < totalCheck.expectedTotal) {
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
        affiliateResult,
        email,
        orderId,
        paymentMethod: "solana_pay",
        reference,
        shippingFeeCents,
        taxCents,
        telegramFirstName,
        telegramUserId,
        telegramUsername,
        totalCents: totalCheck.expectedTotal,
        userId: userIdVal,
      },
      {
        solanaPayDepositAddress: depositAddress,
        ...(reference && typeof reference === "string" && reference.trim()
          ? { solanaPayReference: reference.trim() }
          : {}),
        ...(cryptoCurrency ? { cryptoCurrency } : {}),
        // Shipping address for admin order details
        ...(shipping?.name && { shippingName: shipping.name }),
        ...(shipping?.address1 && { shippingAddress1: shipping.address1 }),
        ...(shipping?.address2 && { shippingAddress2: shipping.address2 }),
        ...(shipping?.city && { shippingCity: shipping.city }),
        ...(shipping?.stateCode && { shippingStateCode: shipping.stateCode }),
        ...(shipping?.zip && { shippingZip: shipping.zip }),
        ...(shipping?.countryCode && {
          shippingCountryCode: shipping.countryCode,
        }),
        ...(shipping?.phone && { shippingPhone: shipping.phone }),
      },
    );

    // ── Insert order items ─────────────────────────────────────────────
    await insertOrderItems(validatedItems, orderId);

    // ── Post-order bookkeeping ─────────────────────────────────────────
    await postOrderBookkeeping({
      affiliateResult,
      couponResult,
      emailMarketingConsent,
      orderId,
      smsMarketingConsent,
      userId: userIdVal,
    });

    // ── eSIM order records (for cart items with esimPackageId) ──────────
    await createEsimOrderRecordsForOrder({
      items: validatedItems,
      orderId,
      paymentMethod: "solana_pay",
      userId: userIdVal,
    });

    return NextResponse.json({
      _actions: {
        cancel: `POST /api/orders/${orderId}/cancel (only before payment)`,
        help: "Contact support@forthecult.store",
        next: `Poll GET /api/orders/${orderId}/status every 5s until status changes`,
      },
      confirmationToken: generateOrderConfirmationToken(orderId),
      depositAddress,
      orderId,
      status: "awaiting_payment",
    });
  } catch (err) {
    console.error("Solana Pay create-order error:", err);
    return NextResponse.json(
      { error: buildOrderErrorMessage(err) },
      { status: 500 },
    );
  }
}
