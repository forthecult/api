import { createId } from "@paralleldrive/cuid2";
import { eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  affiliateTable,
  couponRedemptionTable,
  orderItemsTable,
  ordersTable,
  productVariantsTable,
  productsTable,
} from "~/db/schema";
import { userTable } from "~/db/schema/users/tables";
import { auth } from "~/lib/auth";
import { resolveAffiliateForOrder } from "~/lib/affiliate";
import { resolveCouponForCheckout } from "~/lib/coupon";
import {
  buildSuccessRedirectUrl,
  buildWebhookUrl,
  createBtcpayInvoice,
  getBtcpayConfig,
} from "~/lib/btcpay";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";
import { createOrderSchema, validateBody } from "~/lib/validations/checkout";

type OrderItemBody = {
  productId: string;
  productVariantId?: string;
  name: string;
  priceCents: number;
  quantity: number;
};

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

    const productIds = [...new Set(rawItems.map((i) => i?.productId).filter(Boolean))] as string[];
    const products =
      productIds.length > 0
        ? await db
            .select({ id: productsTable.id, name: productsTable.name, priceCents: productsTable.priceCents })
            .from(productsTable)
            .where(inArray(productsTable.id, productIds))
        : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    const variantIds = rawItems
      .map((i) => i?.productVariantId)
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    const variants =
      variantIds.length > 0
        ? await db
            .select({
              id: productVariantsTable.id,
              productId: productVariantsTable.productId,
              priceCents: productVariantsTable.priceCents,
            })
            .from(productVariantsTable)
            .where(inArray(productVariantsTable.id, variantIds))
        : [];
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const orderItems: OrderItemBody[] = [];
    for (const item of rawItems) {
      if (
        typeof item?.productId !== "string" ||
        typeof item?.quantity !== "number" ||
        item.quantity < 1
      )
        continue;
      const product = productMap.get(item.productId);
      if (!product) continue;
      if (item.productVariantId) {
        const variant = variantMap.get(item.productVariantId);
        if (!variant || variant.productId !== item.productId) continue;
        orderItems.push({
          productId: product.id,
          productVariantId: variant.id,
          name: product.name,
          priceCents: variant.priceCents,
          quantity: item.quantity,
        });
      } else {
        orderItems.push({
          productId: product.id,
          name: product.name,
          priceCents: product.priceCents,
          quantity: item.quantity,
        });
      }
    }
    if (orderItems.length === 0) {
      return NextResponse.json({ error: "No valid order items" }, { status: 400 });
    }

    const subtotalCents = orderItems.reduce(
      (sum, i) => sum + i.priceCents * i.quantity,
      0,
    );
    const affiliateResult = await resolveAffiliateForOrder(
      affiliateCode,
      subtotalCents,
      shippingFeeCents,
    );
    const couponResult = couponCode
      ? await resolveCouponForCheckout(
          couponCode,
          subtotalCents,
          shippingFeeCents,
          {
            userId: session?.user?.id ?? undefined,
            productIds,
          },
        )
      : null;
    const baseTotal = subtotalCents + shippingFeeCents;
    const expectedTotal =
      couponResult?.totalAfterDiscountCents ??
      affiliateResult?.totalAfterDiscountCents ??
      baseTotal;
    const TOLERANCE_CENTS = 100;
    if (Math.abs(totalCents - expectedTotal) > TOLERANCE_CENTS) {
      return NextResponse.json(
        {
          error:
            "Order total does not match. Cart may have changed — refresh the page and try again.",
        },
        { status: 400 },
      );
    }

    const orderId = createId();
    const now = new Date();
    const userIdVal =
      session?.user?.id && validation.data.userId === session.user.id ? session.user.id : null;

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
        const priceUsd = expectedTotal / 100;
        const itemDesc = orderItems.length === 1
          ? orderItems[0].name
          : `Order ${orderId} (${orderItems.length} items)`;
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

    await db.insert(ordersTable).values({
      id: orderId,
      createdAt: now,
      email: email.trim(),
      fulfillmentStatus: "unfulfilled",
      paymentMethod: "btcpay",
      paymentStatus: "pending",
      shippingFeeCents,
      status: "pending",
      totalCents: expectedTotal,
      updatedAt: now,
      userId: userIdVal,
      cryptoCurrency,
      ...(btcpayInvoiceId && { btcpayInvoiceId }),
      ...(btcpayInvoiceUrl && { btcpayInvoiceUrl }),
      ...(reference && typeof reference === "string" && reference.trim()
        ? { customerNote: reference.trim() }
        : {}),
      ...(telegramUserId ? { telegramUserId: String(telegramUserId) } : {}),
      ...(telegramUsername ? { telegramUsername } : {}),
      ...(telegramFirstName ? { telegramFirstName } : {}),
      ...(affiliateResult && {
        affiliateId: affiliateResult.affiliate.affiliateId,
        affiliateCode: affiliateResult.affiliate.affiliateCode,
        affiliateCommissionCents: affiliateResult.affiliate.commissionCents,
        affiliateDiscountCents: affiliateResult.affiliate.discountCents,
      }),
    });

    if (orderItems.length > 0) {
      await db.insert(orderItemsTable).values(
        orderItems.map((item) => ({
          id: createId(),
          name: item.name,
          orderId,
          priceCents: item.priceCents,
          productId: item.productId,
          productVariantId: item.productVariantId ?? null,
          quantity: item.quantity,
        })),
      );
    }

    if (userIdVal && (emailMarketingConsent === true || smsMarketingConsent === true)) {
      await db
        .update(userTable)
        .set({
          updatedAt: now,
          ...(emailMarketingConsent === true && { receiveMarketing: true }),
          ...(smsMarketingConsent === true && { receiveSmsMarketing: true }),
        })
        .where(eq(userTable.id, userIdVal));
    }

    if (affiliateResult) {
      const [row] = await db
        .select({ totalEarnedCents: affiliateTable.totalEarnedCents })
        .from(affiliateTable)
        .where(eq(affiliateTable.id, affiliateResult.affiliate.affiliateId))
        .limit(1);
      const current = row?.totalEarnedCents ?? 0;
      await db
        .update(affiliateTable)
        .set({
          updatedAt: now,
          totalEarnedCents: current + affiliateResult.affiliate.commissionCents,
        })
        .where(eq(affiliateTable.id, affiliateResult.affiliate.affiliateId));
    }

    if (couponResult) {
      await db.insert(couponRedemptionTable).values({
        id: createId(),
        couponId: couponResult.couponId,
        orderId,
        userId: userIdVal,
        createdAt: now,
      });
    }

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
    const message =
      err instanceof Error && (err.message?.includes("relation") || err.message?.includes("does not exist"))
        ? "Database tables missing. Run: bun run db:push"
        : "Failed to create order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
