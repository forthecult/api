import { createId } from "@paralleldrive/cuid2";
import { inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { orderItemsTable, ordersTable, productsTable } from "~/db/schema";
import { getAmazonProducts, isAmazonProductApiConfigured } from "~/lib/amazon-product-api";
import {
  publicApiCorsPreflight,
  withPublicApiCors,
} from "~/lib/cors-public-api";
import { getOptionalMoltbookAgentFromRequest } from "~/lib/moltbook-auth";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";
import { deriveDepositAddress } from "~/lib/solana-deposit";
import {
  getSolanaPayLabel,
  USDC_MINT_MAINNET,
  usdcAmountFromUsd,
} from "~/lib/solana-pay";

const PAYMENT_WINDOW_MS = 60 * 60 * 1000;

type CheckoutItem =
  | { productId: string; quantity: number }
  | { asin: string; quantity: number };

interface CheckoutBody {
  email: string;
  items: CheckoutItem[];
  payment: { chain: string; token: string; tokenMint?: null | string };
  shipping?: {
    address1?: string;
    address2?: string;
    city?: string;
    countryCode?: string;
    name?: string;
    phone?: string;
    stateCode?: string;
    zip?: string;
  };
}

type OrderItemRow = {
  name: string;
  priceCents: number;
  quantity: number;
  productId: string | null;
  source: "store" | "amazon";
  amazonAsin?: string;
  amazonProductUrl?: string;
  imageUrl?: string;
};

/**
 * Agent-friendly checkout: create order and return Solana Pay payment details.
 * POST /api/checkout
 * Supports USDC; poll GET /api/orders/{orderId}/status until paid.
 */
export async function OPTIONS() {
  return publicApiCorsPreflight();
}

export async function POST(request: NextRequest) {
  // Rate limit checkout to prevent order spam and abuse
  const ip = getClientIp(request.headers);
  const rateLimitResult = await checkRateLimit(
    `checkout:${ip}`,
    RATE_LIMITS.checkout,
  );
  if (!rateLimitResult.success) {
    return withPublicApiCors(
      rateLimitResponse(rateLimitResult, RATE_LIMITS.checkout.limit),
    );
  }

  try {
    const body = (await request.json()) as CheckoutBody;
    const { email, items: rawItems, payment } = body;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      return withPublicApiCors(
        NextResponse.json(
          {
            error: { code: "INVALID_REQUEST", message: "Valid email required" },
          },
          { status: 400 },
        ),
      );
    }
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return withPublicApiCors(
        NextResponse.json(
          {
            error: {
              code: "INVALID_REQUEST",
              message: "items required (non-empty array)",
            },
          },
          { status: 400 },
        ),
      );
    }
    if (!payment || payment.chain !== "solana") {
      return withPublicApiCors(
        NextResponse.json(
          {
            error: {
              code: "INVALID_REQUEST",
              message: "payment.chain must be 'solana'",
            },
          },
          { status: 400 },
        ),
      );
    }
    if (payment.token !== "USDC") {
      return withPublicApiCors(
        NextResponse.json(
          {
            error: {
              code: "INVALID_REQUEST",
              message:
                "Only USDC is supported for agent checkout; use payment.token: 'USDC'",
            },
          },
          { status: 400 },
        ),
      );
    }

    const storeItems = rawItems.filter(
      (i): i is { productId: string; quantity: number } =>
        "productId" in i &&
        typeof (i as { productId?: string }).productId === "string" &&
        typeof (i as { quantity: number }).quantity === "number",
    );
    const amazonItems = rawItems.filter(
      (i): i is { asin: string; quantity: number } =>
        "asin" in i &&
        typeof (i as { asin?: string }).asin === "string" &&
        typeof (i as { quantity: number }).quantity === "number",
    );

    for (const item of [...storeItems, ...amazonItems]) {
      const q = item.quantity;
      if (q < 1 || q > 9999) {
        return withPublicApiCors(
          NextResponse.json(
            {
              error: {
                code: "INVALID_REQUEST",
                message: `Invalid quantity for item`,
              },
            },
            { status: 400 },
          ),
        );
      }
    }

    const productIds = [...new Set(storeItems.map((i) => i.productId))];
    const products =
      productIds.length > 0
        ? await db
            .select({
              id: productsTable.id,
              name: productsTable.name,
              priceCents: productsTable.priceCents,
              published: productsTable.published,
            })
            .from(productsTable)
            .where(inArray(productsTable.id, productIds))
        : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    const orderItems: OrderItemRow[] = [];

    for (const item of storeItems) {
      const product = productMap.get(item.productId);
      if (!product || !product.published) continue;
      orderItems.push({
        name: product.name,
        priceCents: product.priceCents,
        quantity: item.quantity,
        productId: product.id,
        source: "store",
      });
    }

    let amazonProductMap = new Map<string, { name: string; price: { usd: number }; productUrl: string; imageUrl?: string }>();
    if (amazonItems.length > 0 && isAmazonProductApiConfigured()) {
      const asins = [...new Set(amazonItems.map((i) => i.asin.trim()))].slice(0, 10);
      const amazonProducts = await getAmazonProducts(asins);
      amazonProductMap = new Map(
        amazonProducts.map((p) => [
          p.asin,
          { name: p.name, price: p.price, productUrl: p.productUrl, imageUrl: p.imageUrl },
        ]),
      );
      for (const item of amazonItems) {
        const p = amazonProductMap.get(item.asin.trim());
        if (!p) continue;
        const priceCents = Math.round(p.price.usd * 100);
        orderItems.push({
          name: p.name,
          priceCents,
          quantity: item.quantity,
          productId: null,
          source: "amazon",
          amazonAsin: item.asin.trim(),
          amazonProductUrl: p.productUrl,
          imageUrl: p.imageUrl,
        });
      }
    }

    if (orderItems.length === 0) {
      return withPublicApiCors(
        NextResponse.json(
          {
            error: {
              code: "INVALID_REQUEST",
              message: "No valid products in items (check productId/asin and quantity)",
            },
          },
          { status: 400 },
        ),
      );
    }

    const subtotalCents = orderItems.reduce(
      (sum, i) => sum + i.priceCents * i.quantity,
      0,
    );
    const shippingFeeCents = 0;
    const totalCents = subtotalCents + shippingFeeCents;
    const subtotalUsd = subtotalCents / 100;
    const totalUsd = totalCents / 100;

    const orderId = createId();
    const now = new Date();
    const depositAddress = deriveDepositAddress(orderId);
    const expiresAt = new Date(now.getTime() + PAYMENT_WINDOW_MS).toISOString();

    const { agent: moltbookAgent } =
      await getOptionalMoltbookAgentFromRequest(request);

    const shipping = body.shipping;
    if (shipping?.countryCode?.trim()) {
      const { isShippingExcluded } = await import(
        "~/lib/shipping-restrictions"
      );
      if (isShippingExcluded(shipping.countryCode)) {
        return withPublicApiCors(
          NextResponse.json(
            {
              error: {
                code: "INVALID_REQUEST",
                message: "We do not ship to this country.",
              },
            },
            { status: 400 },
          ),
        );
      }
    }
    const hasAmazonItems = orderItems.some((i) => i.source === "amazon");

    await db.insert(ordersTable).values({
      createdAt: now,
      email: email.trim(),
      fulfillmentStatus: "unfulfilled",
      hasAmazonItems,
      id: orderId,
      paymentMethod: "solana_pay",
      paymentStatus: "pending",
      shippingFeeCents,
      solanaPayDepositAddress: depositAddress,
      status: "pending",
      totalCents,
      updatedAt: now,
      ...(moltbookAgent?.id && { moltbookAgentId: moltbookAgent.id }),
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
    });

    await db.insert(orderItemsTable).values(
      orderItems.map((item) => ({
        id: createId(),
        name: item.name,
        orderId,
        priceCents: item.priceCents,
        productId: item.productId,
        quantity: item.quantity,
        source: item.source,
        ...(item.source === "amazon" && {
          amazonAsin: item.amazonAsin,
          amazonProductUrl: item.amazonProductUrl,
          imageUrl: item.imageUrl,
        }),
      })),
    );

    const token = payment.token === "USDC" ? "USDC" : payment.token;
    const tokenMint =
      token === "USDC" ? USDC_MINT_MAINNET : (payment.tokenMint ?? null);
    const decimals = token === "USDC" ? 6 : 9;
    const amountBn = usdcAmountFromUsd(totalUsd);
    const amountBaseUnits = amountBn.toFixed(0);
    const label = getSolanaPayLabel();
    const message = "Thank you for your order.";

    const params = new URLSearchParams();
    params.set("amount", amountBaseUnits);
    if (tokenMint) params.set("spl-token", tokenMint);
    params.set("label", `Order ${orderId}`);
    params.set("message", message);
    const solanaPayUrl = `solana:${depositAddress}?${params.toString()}`;

    return withPublicApiCors(
      NextResponse.json(
        {
          expiresAt,
          orderId,
          payment: {
            amount: amountBaseUnits,
            amountHuman: totalUsd.toFixed(2),
            chain: "solana",
            decimals,
            label: `Order ${orderId}`,
            message,
            method: "solana_pay",
            recipient: depositAddress,
            token,
            tokenMint: tokenMint ?? undefined,
            url: solanaPayUrl,
          },
          status: "awaiting_payment",
          totals: {
            shippingUsd: 0,
            subtotalUsd,
            totalUsd,
          },
        },
        {
          headers: getRateLimitHeaders(
            rateLimitResult,
            RATE_LIMITS.checkout.limit,
          ),
          status: 201,
        },
      ),
    );
  } catch (err) {
    console.error("Checkout error:", err);
    return withPublicApiCors(
      NextResponse.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to create checkout",
          },
        },
        { status: 500 },
      ),
    );
  }
}
