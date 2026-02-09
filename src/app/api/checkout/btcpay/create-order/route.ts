import { createId } from "@paralleldrive/cuid2";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "~/lib/auth";
import {
  buildSuccessRedirectUrl,
  buildWebhookUrl,
  createBtcpayInvoice,
  getBtcpayConfig,
} from "~/lib/btcpay";
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

/** Map frontend token to BTCPay/crypto currency (store in order). */
const TOKEN_TO_CURRENCY: Record<string, string> = {
  bitcoin: "BTC",
  doge: "DOGE",
  dogecoin: "DOGE",
  monero: "XMR",
};

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rateLimitResult = checkRateLimit(`checkout:${ip}`, RATE_LIMITS.checkout);
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
    } = validation.data;

    const token = (rawBody as { token?: string }).token?.toLowerCase() ?? "bitcoin";
    const cryptoCurrency = TOKEN_TO_CURRENCY[token] ?? "BTC";

    // ── Validate products & compute subtotal ───────────────────────────
    const productResult = await validateAndFetchProducts(rawItems);
    if (!productResult) {
      return NextResponse.json({ error: "No valid order items" }, { status: 400 });
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

    // ── Payment-method-specific: BTCPay invoice ────────────────────────
    const orderId = createId();
    const userIdVal =
      session?.user?.id && validation.data.userId === session.user.id
        ? session.user.id
        : null;

    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      request.headers.get("x-forwarded-proto") && request.headers.get("x-forwarded-host")
        ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("x-forwarded-host")}`
        : "https://forthecult.store";

    let btcpayInvoiceId: string | null = null;
    let btcpayInvoiceUrl: string | null = null;
    const { configured } = getBtcpayConfig();

    if (configured) {
      try {
        const priceUsd = totalCheck.expectedTotal / 100;
        const itemDesc = validatedItems.length === 1
          ? validatedItems[0].name
          : `Order ${orderId} (${validatedItems.length} items)`;
        const invoice = await createBtcpayInvoice({
          price: priceUsd,
          currency: "USD",
          orderId,
          itemDesc,
          notificationURL: buildWebhookUrl(origin),
          redirectURL: buildSuccessRedirectUrl(origin, orderId),
        });
        if (invoice) {
          btcpayInvoiceId = invoice.id;
          btcpayInvoiceUrl = invoice.url;
        }
      } catch (err) {
        console.error("BTCPay create invoice error:", err);
        return NextResponse.json(
          { error: "Payment provider temporarily unavailable. Please try again or use another method." },
          { status: 502 },
        );
      }
    }

    // ── Insert order ───────────────────────────────────────────────────
    await insertOrder(
      {
        orderId,
        email,
        paymentMethod: "btcpay",
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
        cryptoCurrency,
        ...(btcpayInvoiceId && { btcpayInvoiceId }),
        ...(btcpayInvoiceUrl && { btcpayInvoiceUrl }),
        ...(reference && typeof reference === "string" && reference.trim()
          ? { customerNote: reference.trim() }
          : {}),
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
      configured,
      ...(btcpayInvoiceId && { invoiceId: btcpayInvoiceId }),
      ...(btcpayInvoiceUrl && { invoiceUrl: btcpayInvoiceUrl }),
      _actions: {
        next: "Redirect to /checkout/{orderId}#bitcoin (or #doge, #monero) and poll status until paid.",
        cancel: `POST /api/orders/${orderId}/cancel (only before payment)`,
        help: "Contact support@forthecut.store",
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
