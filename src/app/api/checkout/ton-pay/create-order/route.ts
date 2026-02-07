import { createId } from "@paralleldrive/cuid2";
import { eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

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
import { getCoinGeckoSimplePrice } from "~/lib/coingecko";
import { resolveCouponForCheckout } from "~/lib/coupon";
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

type OrderItemBody = {
  productId: string;
  productVariantId?: string;
  name: string;
  priceCents: number;
  quantity: number;
};

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
  const rateLimitResult = checkRateLimit(
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
    } = validation.data;

    const productIds = [
      ...new Set(rawItems.map((i) => i?.productId).filter(Boolean)),
    ] as string[];
    const products =
      productIds.length > 0
        ? await db
            .select({
              id: productsTable.id,
              name: productsTable.name,
              priceCents: productsTable.priceCents,
            })
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
      return NextResponse.json(
        { error: "No valid order items" },
        { status: 400 },
      );
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

    const depositAddress = getTonWalletAddress();
    if (!depositAddress) {
      return NextResponse.json(
        { error: "TON wallet not configured." },
        { status: 503 },
      );
    }

    const tonUsdRate = await getTonUsdRate();
    const tonAmount = usdCentsToTonAmount(totalCents, tonUsdRate);

    const orderId = createId();
    const now = new Date();
    const userIdVal =
      session?.user?.id && validation.data.userId === session.user.id
        ? session.user.id
        : null;
    const expiresAt = new Date(now.getTime() + PAYMENT_WINDOW_MS).toISOString();

    await db.insert(ordersTable).values({
      id: orderId,
      createdAt: now,
      email: email.trim(),
      fulfillmentStatus: "unfulfilled",
      paymentMethod: "ton_pay",
      paymentStatus: "pending",
      shippingFeeCents,
      taxCents,
      status: "pending",
      totalCents: expectedTotal,
      updatedAt: now,
      userId: userIdVal,
      solanaPayDepositAddress: depositAddress,
      cryptoCurrency: "TON",
      cryptoAmount: tonAmount,
      cryptoCurrencyNetwork: "ton",
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

    if (
      userIdVal &&
      (emailMarketingConsent === true || smsMarketingConsent === true)
    ) {
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
      depositAddress,
      tonAmount,
      totalCents: expectedTotal,
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
    const message =
      err instanceof Error &&
      (err.message?.includes("relation") ||
        err.message?.includes("does not exist"))
        ? "Database tables missing. Run: bun run db:push"
        : "Failed to create order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
