import { createId } from "@paralleldrive/cuid2";
import { type NextRequest, NextResponse } from "next/server";

import { auth } from "~/lib/auth";
import {
  buildSuccessRedirectUrl,
  buildWebhookUrl,
  createBtcpayInvoice,
  getBtcpayConfig,
} from "~/lib/btcpay";
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
import { createOrderSchema, validateBody } from "~/lib/validations/checkout";
import { verifyWalletForTier } from "~/lib/wallet-tier-verify";

/** Map frontend token to BTCPay/crypto currency (store in order). */
const TOKEN_TO_CURRENCY: Record<string, string> = {
  bitcoin: "BTC",
  doge: "DOGE",
  dogecoin: "DOGE",
  monero: "XMR",
};

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rateLimitResult = await checkRateLimit(
    `checkout:${ip}`,
    RATE_LIMITS.checkout,
  );
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
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

    const token =
      (rawBody as { token?: string }).token?.toLowerCase() ?? "bitcoin";
    const cryptoCurrency = TOKEN_TO_CURRENCY[token] ?? "BTC";

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
        paymentMethodKey: "crypto_bitcoin",
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

    // ── Payment-method-specific: BTCPay invoice ────────────────────────
    const orderId = createId();
    const userIdVal =
      session?.user?.id && validation.data.userId === session.user.id
        ? session.user.id
        : null;

    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://forthecult.store";

    let btcpayInvoiceId: null | string = null;
    let btcpayInvoiceUrl: null | string = null;
    const { configured } = getBtcpayConfig();

    if (configured) {
      try {
        const priceUsd = totalCheck.expectedTotal / 100;
        const itemDesc =
          validatedItems.length === 1
            ? validatedItems[0].name
            : `Order ${orderId} (${validatedItems.length} items)`;
        const invoice = await createBtcpayInvoice({
          currency: "USD",
          itemDesc,
          notificationURL: buildWebhookUrl(origin),
          orderId,
          price: priceUsd,
          redirectURL: buildSuccessRedirectUrl(origin, orderId),
        });
        if (invoice) {
          btcpayInvoiceId = invoice.id;
          btcpayInvoiceUrl = invoice.url;
        }
      } catch (err) {
        console.error("BTCPay create invoice error:", err);
        return NextResponse.json(
          {
            error:
              "Payment provider temporarily unavailable. Please try again or use another method.",
          },
          { status: 502 },
        );
      }
    }

    // ── Insert order ───────────────────────────────────────────────────
    await insertOrder(
      {
        affiliateResult,
        email,
        orderId,
        paymentMethod: "btcpay",
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
        cryptoCurrency,
        ...(btcpayInvoiceId && { btcpayInvoiceId }),
        ...(btcpayInvoiceUrl && { btcpayInvoiceUrl }),
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
      paymentMethod: "btcpay",
      userId: userIdVal,
    });

    return NextResponse.json({
      configured,
      confirmationToken: generateOrderConfirmationToken(orderId),
      orderId,
      ...(btcpayInvoiceId && { invoiceId: btcpayInvoiceId }),
      ...(btcpayInvoiceUrl && { invoiceUrl: btcpayInvoiceUrl }),
      _actions: {
        cancel: `POST /api/orders/${orderId}/cancel (only before payment)`,
        help: "Contact support@forthecult.store",
        next: "Redirect to /checkout/{orderId}#bitcoin (or #doge, #monero) and poll status until paid.",
      },
    });
  } catch (err) {
    console.error("BTCPay create-order error:", err);
    return NextResponse.json(
      { error: buildOrderErrorMessage(err) },
      { status: 500 },
    );
  }
}
