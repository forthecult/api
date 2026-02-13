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
import {
  getPaymentReceiverAddress,
  isFactoryDeployed,
  isTokenSupportedOnChain,
  usdCentsToTokenAmount,
  getTokenAddress,
  orderIdToBytes32,
  FACTORY_ADDRESSES,
} from "~/lib/contracts/evm-payment";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";
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
  const rateLimitResult = await checkRateLimit(
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

    // Validate required fields (custom validation, not createOrderSchema)
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
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

    // ── Validate products & compute subtotal ───────────────────────────
    const productResult = await validateAndFetchProducts(rawItems);
    if (!productResult) {
      return NextResponse.json(
        { error: "No valid order items" },
        { status: 400 },
      );
    }
    const { validatedItems, productIds, subtotalCents } = productResult;

    // ── Server-side shipping calculation ───────────────────────────────
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

    // ── Resolve discounts ──────────────────────────────────────────────
    // Map token to payment method key
    const tokenUp = token.toUpperCase();
    const paymentMethodKey =
      tokenUp === "USDC"
        ? "stablecoin_usdc"
        : tokenUp === "USDT"
          ? "stablecoin_usdt"
          : "crypto_ethereum";

    const { affiliateResult, couponResult, expectedTotal } =
      await resolveDiscounts({
        affiliateCode,
        couponCode,
        subtotalCents,
        shippingFeeCents: shippingRounded,
        userId: session?.user?.id,
        productIds,
        paymentMethodKey,
        items: validatedItems.map(i => ({ productId: i.productId, priceCents: i.priceCents, quantity: i.quantity })),
      });

    // ── Validate client total ($5 tolerance for crypto price drift) ───
    const totalCheck = validateTotal({
      clientTotalCents: totalCents,
      expectedTotal,
      toleranceCents: 100,
    });
    if (!totalCheck.valid) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[eth-pay create-order] totalCents mismatch:",
          JSON.stringify(
            {
              receivedTotalCents: totalCents,
              expectedTotalCents: expectedTotal,
              subtotalCents,
              shippingCents: shippingRounded,
              itemCount: validatedItems.length,
            },
            null,
            2,
          ),
        );
      }
      return NextResponse.json(
        {
          error: "Order total does not match. Please refresh and try again.",
          code: "TOTAL_MISMATCH",
        },
        { status: 400 },
      );
    }

    // ── ETH-specific: chain / token / deposit address ─────────────────
    const orderId = createId();
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
      const amountWei = usdCentsToTokenAmount(
        totalCheck.expectedTotal,
        tokenUpper,
      );
      cryptoAmount = amountWei.toString();
      tokenAddress = getTokenAddress(chainId, tokenUpper);
    }

    // Get the bytes32 salt for reference
    const orderIdBytes32 = orderIdToBytes32(orderId);

    // ── Insert order ───────────────────────────────────────────────────
    await insertOrder(
      {
        orderId,
        email,
        paymentMethod: "eth_pay",
        totalCents: totalCheck.expectedTotal,
        shippingFeeCents: shippingRounded,
        taxCents,
        userId: userIdVal,
        telegramUserId,
        telegramUsername,
        telegramFirstName,
        affiliateResult,
      },
      {
        solanaPayDepositAddress: depositAddress, // Reuse this field for all crypto deposit addresses
        cryptoCurrencyNetwork: chain.toLowerCase(),
        cryptoCurrency: tokenUpper,
        cryptoAmount,
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
      paymentMethod: "eth_pay",
      items: validatedItems,
    });

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    return NextResponse.json({
      orderId,
      confirmationToken: generateOrderConfirmationToken(orderId),
      depositAddress,
      chain: chain.toLowerCase(),
      token: tokenUpper,
      chainId,
      totalCents: totalCheck.expectedTotal,
      // Include crypto amount for USDC/USDT (null for ETH - calculated on frontend)
      cryptoAmount,
      tokenAddress,
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
    return NextResponse.json(
      { error: buildOrderErrorMessage(err) },
      { status: 500 },
    );
  }
}
