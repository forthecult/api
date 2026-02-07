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
import { resolveCouponForCheckout } from "~/lib/coupon";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";
import {
  getPaymentReceiverAddress,
  isFactoryDeployed,
  isTokenSupportedOnChain,
  usdCentsToTokenAmount,
  formatTokenAmount,
  getTokenAddress,
  orderIdToBytes32,
  FACTORY_ADDRESSES,
} from "~/lib/contracts/evm-payment";
import { runShippingCalculate } from "~/lib/shipping-calculate";
import { normalizeCountryCode } from "~/lib/validations/checkout";

// Map chain names to chain IDs
const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
  polygon: 137,
  bnb: 56,
  optimism: 10,
};

/**
 * Get the deterministic payment receiver address for an order.
 * Uses CREATE2 to compute the address where a minimal proxy will be deployed.
 * The address is deterministic and can receive payments before deployment.
 */
function deriveEthDepositAddress(
  orderId: string,
  chainId: number,
): string | null {
  // Use the CREATE2 deterministic address from our factory contract
  const address = getPaymentReceiverAddress(chainId, orderId);
  return address;
}

type OrderItemBody = {
  productId: string;
  productVariantId?: string;
  name: string;
  priceCents: number;
  quantity: number;
};

interface CreateEthOrderBody {
  email: string;
  orderItems: Array<{
    productId: string;
    productVariantId?: string;
    quantity: number;
  }>;
  totalCents: number;
  shippingFeeCents?: number;
  taxCents?: number;
  chain: string;
  token: string;
  userId?: string;
  affiliateCode?: string;
  couponCode?: string;
  emailMarketingConsent?: boolean;
  smsMarketingConsent?: boolean;
  telegramUserId?: string;
  telegramUsername?: string;
  telegramFirstName?: string;
  shipping?: {
    name?: string;
    address1?: string;
    address2?: string;
    city?: string;
    stateCode?: string;
    countryCode?: string;
    zip?: string;
    phone?: string;
  };
}

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

  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const body = (await request.json()) as CreateEthOrderBody;

    const {
      email,
      orderItems: rawItems,
      totalCents,
      shippingFeeCents = 0,
      taxCents = 0,
      chain,
      token,
      affiliateCode,
      couponCode,
      shipping,
      emailMarketingConsent,
      smsMarketingConsent,
      telegramUserId,
      telegramUsername,
      telegramFirstName,
    } = body;

    // Validate required fields
    if (!email?.trim()) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json(
        { error: "orderItems required" },
        { status: 400 },
      );
    }
    if (typeof totalCents !== "number" || totalCents <= 0) {
      return NextResponse.json(
        { error: "totalCents required" },
        { status: 400 },
      );
    }
    if (!chain?.trim()) {
      return NextResponse.json({ error: "chain required" }, { status: 400 });
    }
    if (!token?.trim()) {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }

    // Validate products
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

    // Validate totals: use server-side subtotal (DB prices) and server-side shipping when address provided
    const subtotalCents = orderItems.reduce(
      (sum, i) => sum + i.priceCents * i.quantity,
      0,
    );
    const rawCountry = shipping?.countryCode?.trim();
    const countryCode =
      rawCountry && rawCountry.length >= 2
        ? normalizeCountryCode(rawCountry)
        : undefined;
    if (countryCode && countryCode.length >= 2) {
      const { isShippingExcluded } = await import(
        "~/lib/shipping-restrictions"
      );
      if (isShippingExcluded(countryCode)) {
        return NextResponse.json(
          { error: "We do not ship to this country." },
          { status: 400 },
        );
      }
    }
    let shippingCentsForTotal: number;
    if (countryCode && countryCode.length >= 2) {
      const serverShipping = await runShippingCalculate({
        countryCode,
        orderValueCents: subtotalCents,
        items: rawItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      });
      shippingCentsForTotal =
        "shippingCents" in serverShipping ? serverShipping.shippingCents : 0;
    } else {
      shippingCentsForTotal = Number(shippingFeeCents) || 0;
    }
    const shippingRounded = Math.round(shippingCentsForTotal);
    const affiliateResult = await resolveAffiliateForOrder(
      affiliateCode,
      subtotalCents,
      shippingRounded,
    );
    const couponResult = couponCode
      ? await resolveCouponForCheckout(
          couponCode,
          subtotalCents,
          shippingRounded,
          {
            userId: session?.user?.id ?? undefined,
            productIds: orderItems.map((i) => i.productId),
          },
        )
      : null;
    const baseTotal = subtotalCents + shippingRounded;
    const expectedTotal =
      couponResult?.totalAfterDiscountCents ??
      affiliateResult?.totalAfterDiscountCents ??
      baseTotal;
    const TOLERANCE_CENTS = 500; // $5: display rounding, cart vs DB price drift, shipping timing
    if (Math.abs(totalCents - expectedTotal) > TOLERANCE_CENTS) {
      // Log detailed error server-side only (never expose to client)
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[eth-pay create-order] totalCents mismatch:",
          JSON.stringify(
            {
              receivedTotalCents: totalCents,
              expectedTotalCents: expectedTotal,
              subtotalCents,
              shippingCents: shippingRounded,
              itemCount: orderItems.length,
            },
            null,
            2,
          ),
        );
      }
      // Return generic error to client (no internal details)
      return NextResponse.json(
        {
          error: "Order total does not match. Please refresh and try again.",
          code: "TOTAL_MISMATCH",
        },
        { status: 400 },
      );
    }

    const orderId = createId();
    const now = new Date();
    // Use session user ID directly - never trust userId from request body
    const userIdVal = session?.user?.id ?? null;
    const chainId = CHAIN_IDS[chain.toLowerCase()] ?? 1;

    // Validate chain support
    if (!isFactoryDeployed(chainId)) {
      return NextResponse.json(
        {
          error: `Payment not yet supported on ${chain}. Factory contract not deployed.`,
        },
        { status: 400 },
      );
    }

    // Validate token support on this chain
    const tokenUpper = token.toUpperCase() as "ETH" | "USDC" | "USDT";
    if (!isTokenSupportedOnChain(chainId, tokenUpper)) {
      return NextResponse.json(
        { error: `${token} is not supported on ${chain}` },
        { status: 400 },
      );
    }

    // Get deterministic payment receiver address using CREATE2
    const depositAddress = deriveEthDepositAddress(orderId, chainId);
    if (!depositAddress) {
      return NextResponse.json(
        {
          error:
            "Could not generate payment address. Factory not configured for this chain.",
        },
        { status: 500 },
      );
    }

    // Calculate crypto amount
    let cryptoAmount: string | null = null;
    let tokenAddress: string | null = null;

    if (tokenUpper === "ETH") {
      // For ETH, we'll fetch price on frontend; store null for now
      // The frontend will calculate the exact ETH amount at payment time
      cryptoAmount = null;
    } else {
      // USDC/USDT: 1:1 with USD, 6 decimals
      const amountWei = usdCentsToTokenAmount(expectedTotal, tokenUpper);
      cryptoAmount = amountWei.toString();
      tokenAddress = getTokenAddress(chainId, tokenUpper);
    }

    // Get the bytes32 salt for reference
    const orderIdBytes32 = orderIdToBytes32(orderId);

    await db.insert(ordersTable).values({
      id: orderId,
      createdAt: now,
      email: email.trim(),
      fulfillmentStatus: "unfulfilled",
      paymentMethod: "eth_pay",
      paymentStatus: "pending",
      shippingFeeCents: shippingRounded,
      taxCents,
      solanaPayDepositAddress: depositAddress, // Reuse this field for all crypto deposit addresses
      status: "pending",
      totalCents: expectedTotal,
      updatedAt: now,
      userId: userIdVal,
      cryptoCurrencyNetwork: chain.toLowerCase(),
      cryptoCurrency: tokenUpper,
      cryptoAmount: cryptoAmount,
      chainId,
      // Shipping fields
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

    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour

    return NextResponse.json({
      orderId,
      depositAddress,
      chain: chain.toLowerCase(),
      token: tokenUpper,
      chainId,
      totalCents: expectedTotal,
      // Include crypto amount for USDC/USDT (null for ETH - calculated on frontend)
      cryptoAmount: cryptoAmount,
      tokenAddress: tokenAddress,
      // Factory address for contract interaction
      factoryAddress: FACTORY_ADDRESSES[chainId],
      orderIdBytes32,
      expiresAt,
      status: "awaiting_payment",
      _actions: {
        pay: "Send payment to depositAddress using connected wallet",
        status: `GET /api/checkout/eth-pay/status?orderId=${orderId}`,
        cancel: `POST /api/checkout/eth-pay/cancel (only before payment confirmed)`,
      },
    });
  } catch (err) {
    console.error("ETH Pay create-order error:", err);
    const message =
      err instanceof Error &&
      (err.message?.includes("relation") ||
        err.message?.includes("does not exist"))
        ? "Database tables missing. Run: bun run db:push"
        : "Failed to create order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
