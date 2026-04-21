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
import { getCoinGeckoSimplePrice } from "~/lib/coingecko";
import { generateOrderConfirmationToken } from "~/lib/order-confirmation-token";
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
import { verifyWalletForTier } from "~/lib/wallet-tier-verify";

const TON_USD_FALLBACK = 7;
const PAYMENT_WINDOW_MS = 60 * 60 * 1000;

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
      affiliateCode,
      couponCode,
      email,
      emailMarketingConsent,
      memberTier,
      orderItems: rawItems,
      reference,
      shipping,
      shippingFeeCents = 0,
      smsMarketingConsent,
      taxCents = 0,
      telegramFirstName,
      telegramUserId,
      telegramUsername,
      totalCents,
      wallet,
      walletMessage,
      walletSignature,
      walletSignatureBase58,
    } = validation.data;

    if (wallet) {
      const verification = await verifyWalletForTier({
        userId: session?.user?.id,
        wallet,
        walletMessage: walletMessage ?? undefined,
        walletSignature: walletSignature ?? undefined,
        walletSignatureBase58: walletSignatureBase58 ?? undefined,
      });
      if (!verification.ok) {
        return NextResponse.json(
          {
            code: "WALLET_VERIFICATION_REQUIRED",
            error: verification.error,
          },
          { status: 400 },
        );
      }
    }

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
    const { affiliateResult, couponResult, expectedTotal } =
      await resolveDiscounts({
        affiliateCode,
        couponCode,
        items: validatedItems.map((i) => ({
          priceCents: i.priceCents,
          productId: i.productId,
          quantity: i.quantity,
        })),
        memberTier: memberTier ?? undefined,
        paymentMethodKey: "crypto_ton",
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
      toleranceCents: 100,
    });
    if (!totalCheck.valid && totalCents < totalCheck.expectedTotal) {
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
    const expiresAt = new Date(now.getTime() + PAYMENT_WINDOW_MS).toISOString();

    // ── Insert order ───────────────────────────────────────────────────
    await insertOrder(
      {
        affiliateResult,
        email,
        orderId,
        paymentMethod: "ton_pay",
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
        cryptoAmount: tonAmount,
        cryptoCurrency: "TON",
        cryptoCurrencyNetwork: "ton",
        solanaPayDepositAddress: depositAddress,
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
      paymentMethod: "ton_pay",
      userId: userIdVal,
    });

    return NextResponse.json({
      _actions: {
        next: "Redirect to /checkout/{orderId}#ton and poll GET /api/checkout/ton-pay/status until settled.",
        pay: "Send TON to depositAddress with comment=orderId (ton://transfer/... or wallet app).",
      },
      /** Use this as transfer comment so we can match payment to order. */
      comment: orderId,
      confirmationToken: generateOrderConfirmationToken(orderId),
      depositAddress,
      expiresAt,
      orderId,
      tonAmount,
      totalCents: totalCheck.expectedTotal,
    });
  } catch (err) {
    console.error("TON Pay create-order error:", err);
    return NextResponse.json(
      { error: buildOrderErrorMessage(err) },
      { status: 500 },
    );
  }
}

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
