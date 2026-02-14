import { createId } from "@paralleldrive/cuid2";
import { type NextRequest, NextResponse } from "next/server";

import { auth } from "~/lib/auth";
import { generateOrderConfirmationToken } from "~/lib/order-confirmation-token";
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
import { getCoinGeckoSimplePrice } from "~/lib/coingecko";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";
import {
  getTonWalletAddress,
  isTonPayConfigured,
  usdCentsToTonAmount,
} from "~/lib/ton-pay";
import { createOrderSchema, validateBody } from "~/lib/validations/checkout";

const TON_USD_FALLBACK = 7;
const PAYMENT_WINDOW_MS = 60 * 60 * 1000;

async function getTonUsdRate(): Promise<number> {
  try {
    const data = await getCoinGeckoSimplePrice(["toncoin"]);
    const rate = data?.toncoin?.usd;
    if (typeof rate === "number" && rate > 0) return rate;
  } catch {
    // use fallback
  }
  return TON_USD_FALLBACK;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rateLimitResult = await checkRateLimit(
    `checkout:${ip}`,
    RATE_LIMITS.checkout,
  );
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  if (!isTonPayConfigured()) {
    return NextResponse.json(
      { error: "TON payments are not configured (TON_WALLET_ADDRESS)." },
      { status: 503 },
    );
  }

  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const rawBody = await request.json();

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
      wallet,
      shipping,
    } = validation.data;

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
        paymentMethodKey: "crypto_ton",
        items: validatedItems.map(i => ({ productId: i.productId, priceCents: i.priceCents, quantity: i.quantity })),
        wallet: wallet ?? undefined,
      });

    // ── Validate client total ──────────────────────────────────────────
    const totalCheck = validateTotal({
      clientTotalCents: totalCents,
      expectedTotal,
      toleranceCents: 100,
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

    // ── Payment-method-specific: TON deposit address & amount ─────────
    const depositAddress = getTonWalletAddress();
    if (!depositAddress) {
      return NextResponse.json(
        { error: "TON wallet not configured." },
        { status: 503 },
      );
    }

    const tonUsdRate = await getTonUsdRate();
    const tonAmount = usdCentsToTonAmount(totalCheck.expectedTotal, tonUsdRate);

    const orderId = createId();
    const userIdVal =
      session?.user?.id && validation.data.userId === session.user.id
        ? session.user.id
        : null;
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + PAYMENT_WINDOW_MS,
    ).toISOString();

    // ── Insert order ───────────────────────────────────────────────────
    await insertOrder(
      {
        orderId,
        email,
        paymentMethod: "ton_pay",
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
        cryptoCurrency: "TON",
        cryptoAmount: tonAmount,
        cryptoCurrencyNetwork: "ton",
        ...(reference && typeof reference === "string" && reference.trim()
          ? { customerNote: reference.trim() }
          : {}),
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
      orderId,
      userId: userIdVal,
      affiliateResult,
      couponResult,
      emailMarketingConsent,
      smsMarketingConsent,
    });

    // ── eSIM order records (for cart items with esimPackageId) ──────────
    await createEsimOrderRecordsForOrder({
      orderId,
      userId: userIdVal,
      paymentMethod: "ton_pay",
      items: validatedItems,
    });

    return NextResponse.json({
      orderId,
      confirmationToken: generateOrderConfirmationToken(orderId),
      depositAddress,
      tonAmount,
      totalCents: totalCheck.expectedTotal,
      expiresAt,
      /** Use this as transfer comment so we can match payment to order. */
      comment: orderId,
      _actions: {
        next: "Redirect to /checkout/{orderId}#ton and poll GET /api/checkout/ton-pay/status until settled.",
        pay: "Send TON to depositAddress with comment=orderId (ton://transfer/... or wallet app).",
      },
    });
  } catch (err) {
    console.error("TON Pay create-order error:", err);
    return NextResponse.json(
      { error: buildOrderErrorMessage(err) },
      { status: 500 },
    );
  }
}
