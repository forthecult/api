import { createId } from "@paralleldrive/cuid2";
import { inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { orderItemsTable, ordersTable, productsTable } from "~/db/schema";
import {
  getAmazonProducts,
  isAmazonProductApiConfigured,
} from "~/lib/amazon-product-api";
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
import { USDC_MINT_MAINNET, usdcAmountFromUsd } from "~/lib/solana-pay";

const PAYMENT_WINDOW_MS = 60 * 60 * 1000;

const X402_PAY_TO_SOLANA = process.env.X402_PAY_TO_SOLANA_ADDRESS?.trim();
const X402_FACILITATOR =
  process.env.X402_FACILITATOR_URL?.trim() || "https://x402.org/facilitator";

type CheckoutItem =
  | { asin: string; quantity: number }
  | { productId: string; quantity: number };

interface OrderItemRow {
  amazonAsin?: string;
  amazonProductUrl?: string;
  imageUrl?: string;
  name: string;
  priceCents: number;
  productId: null | string;
  quantity: number;
  source: "amazon" | "store";
}

interface X402CheckoutBody {
  email: string;
  items: CheckoutItem[];
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

interface X402PaymentRequirements {
  accepts: {
    amount: string;
    asset: string;
    extra?: {
      feePayer?: string;
      memo?: string;
      orderId?: string;
    };
    maxAmountRequired: string;
    maxTimeoutSeconds: number;
    payTo: string;
  }[];
  network: string;
  resource: string;
  scheme: string;
  x402Version: number;
}

/**
 * x402 checkout endpoint.
 * POST /api/checkout/x402
 *
 * Flow:
 * 1. Agent POSTs order details (no payment header) → returns 402 with payment requirements
 * 2. Agent builds USDC transfer transaction with memo "FTC Order: {orderId}"
 * 3. Agent retries with X-PAYMENT header containing signed transaction
 * 4. Server verifies/settles via facilitator, creates order
 */
export async function OPTIONS() {
  return publicApiCorsPreflight();
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rateLimitResult = await checkRateLimit(
    `checkout:x402:${ip}`,
    RATE_LIMITS.checkout,
  );
  if (!rateLimitResult.success) {
    return withPublicApiCors(
      rateLimitResponse(rateLimitResult, RATE_LIMITS.checkout.limit),
    );
  }

  const paymentHeader = request.headers.get("X-PAYMENT");
  const isPaymentAttempt = !!paymentHeader;

  try {
    const body = (await request.json()) as X402CheckoutBody;
    const { email, items: rawItems } = body;

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
                message: "Invalid quantity for item",
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
      if (!product?.published) continue;
      orderItems.push({
        name: product.name,
        priceCents: product.priceCents,
        productId: product.id,
        quantity: item.quantity,
        source: "store",
      });
    }

    let amazonProductMap = new Map<
      string,
      {
        imageUrl?: string;
        name: string;
        price: { usd: number };
        productUrl: string;
      }
    >();
    if (amazonItems.length > 0 && isAmazonProductApiConfigured()) {
      const asins = [...new Set(amazonItems.map((i) => i.asin.trim()))].slice(
        0,
        10,
      );
      const amazonProducts = await getAmazonProducts(asins);
      amazonProductMap = new Map(
        amazonProducts.map((p) => [
          p.asin,
          {
            imageUrl: p.imageUrl,
            name: p.name,
            price: p.price,
            productUrl: p.productUrl,
          },
        ]),
      );
      for (const item of amazonItems) {
        const p = amazonProductMap.get(item.asin.trim());
        if (!p) continue;
        const priceCents = Math.round(p.price.usd * 100);
        orderItems.push({
          amazonAsin: item.asin.trim(),
          amazonProductUrl: p.productUrl,
          imageUrl: p.imageUrl,
          name: p.name,
          priceCents,
          productId: null,
          quantity: item.quantity,
          source: "amazon",
        });
      }
    }

    if (orderItems.length === 0) {
      return withPublicApiCors(
        NextResponse.json(
          {
            error: {
              code: "INVALID_REQUEST",
              message:
                "No valid products in items (check productId/asin and quantity)",
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
    const requestUrl = new URL(request.url);
    const resource = `${requestUrl.origin}/api/checkout/x402`;

    if (!isPaymentAttempt) {
      const paymentRequirements = buildX402PaymentRequirements(
        orderId,
        totalUsd,
        resource,
      );
      const paymentRequiredBase64 = Buffer.from(
        JSON.stringify(paymentRequirements),
      ).toString("base64");

      return withPublicApiCors(
        NextResponse.json(
          {
            _actions: {
              documentation: "https://x402.org/docs",
              next: `Sign a USDC transfer transaction and retry with X-PAYMENT header`,
            },
            _x402: paymentRequirements,
            code: "PAYMENT_REQUIRED",
            message: `Payment required: send ${totalUsd.toFixed(2)} USDC to complete order`,
            orderId,
            paymentInstructions: {
              amount: paymentRequirements.accepts[0]?.amount,
              amountHuman: totalUsd.toFixed(2),
              maxTimeoutSeconds: 300,
              memo: `FTC Order: ${orderId}`,
              network: "solana",
              payTo: paymentRequirements.accepts[0]?.payTo,
              protocol: "x402",
              token: "USDC",
              tokenMint: USDC_MINT_MAINNET,
            },
            totals: {
              shippingUsd: 0,
              subtotalUsd,
              totalUsd,
            },
          },
          {
            headers: {
              ...getRateLimitHeaders(
                rateLimitResult,
                RATE_LIMITS.checkout.limit,
              ),
              "PAYMENT-REQUIRED": paymentRequiredBase64,
              "WWW-Authenticate": `x402 scheme="exact" network="solana"`,
            },
            status: 402,
          },
        ),
      );
    }

    let paymentPayload: { signature?: string; transaction?: string } = {};
    try {
      const parsed = JSON.parse(
        Buffer.from(paymentHeader, "base64").toString("utf8"),
      ) as { signature?: string; transaction?: string };
      paymentPayload = parsed;
    } catch {
      return withPublicApiCors(
        NextResponse.json(
          {
            error: {
              code: "INVALID_PAYMENT",
              message: "X-PAYMENT header must be base64-encoded JSON",
            },
          },
          { status: 400 },
        ),
      );
    }

    const { signature: txSignature, transaction: signedTx } = paymentPayload;
    if (!signedTx && !txSignature) {
      return withPublicApiCors(
        NextResponse.json(
          {
            error: {
              code: "INVALID_PAYMENT",
              message:
                "X-PAYMENT payload must contain transaction (base64) or signature",
            },
          },
          { status: 400 },
        ),
      );
    }

    let transactionSignature = txSignature;

    if (signedTx && !txSignature) {
      try {
        const verifyResponse = await fetch(`${X402_FACILITATOR}/verify`, {
          body: JSON.stringify({
            paymentPayload: {
              network: "solana",
              payload: { transaction: signedTx },
              scheme: "exact",
              x402Version: 1,
            },
            paymentRequirements: buildX402PaymentRequirements(
              orderId,
              totalUsd,
              resource,
            ).accepts[0],
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        const verifyResult = (await verifyResponse.json()) as {
          invalidReason?: string;
          isValid: boolean;
        };
        if (!verifyResult.isValid) {
          return withPublicApiCors(
            NextResponse.json(
              {
                error: {
                  code: "PAYMENT_INVALID",
                  message: `Payment verification failed: ${verifyResult.invalidReason}`,
                },
              },
              { status: 400 },
            ),
          );
        }

        const settleResponse = await fetch(`${X402_FACILITATOR}/settle`, {
          body: JSON.stringify({
            paymentPayload: {
              network: "solana",
              payload: { transaction: signedTx },
              scheme: "exact",
              x402Version: 1,
            },
            paymentRequirements: buildX402PaymentRequirements(
              orderId,
              totalUsd,
              resource,
            ).accepts[0],
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        const settleResult = (await settleResponse.json()) as {
          errorReason?: string;
          success: boolean;
          transaction?: string;
        };
        if (!settleResult.success) {
          return withPublicApiCors(
            NextResponse.json(
              {
                error: {
                  code: "PAYMENT_FAILED",
                  message: `Payment settlement failed: ${settleResult.errorReason}`,
                },
              },
              { status: 400 },
            ),
          );
        }

        transactionSignature = settleResult.transaction;
      } catch (err) {
        console.error("x402 facilitator error:", err);
        return withPublicApiCors(
          NextResponse.json(
            {
              error: {
                code: "PAYMENT_ERROR",
                message: "Failed to process payment with facilitator",
              },
            },
            { status: 500 },
          ),
        );
      }
    }

    const now = new Date();
    const depositAddress = deriveDepositAddress(orderId);
    const _expiresAt = new Date(
      now.getTime() + PAYMENT_WINDOW_MS,
    ).toISOString();

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
      cryptoCurrency: "USDC",
      cryptoCurrencyNetwork: "Solana",
      cryptoTxHash: transactionSignature,
      email: email.trim(),
      fulfillmentStatus: "unfulfilled",
      hasAmazonItems,
      id: orderId,
      paymentMethod: "x402_usdc",
      paymentStatus: "paid",
      shippingFeeCents,
      solanaPayDepositAddress: depositAddress,
      status: "paid",
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

    return withPublicApiCors(
      NextResponse.json(
        {
          _actions: {
            details: `/api/orders/${orderId}`,
            next: "Order is paid and processing",
            status: `/api/orders/${orderId}/status`,
          },
          orderId,
          payment: {
            method: "x402_usdc",
            network: "solana",
            token: "USDC",
            transactionSignature,
          },
          status: "paid",
          success: true,
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
    console.error("x402 checkout error:", err);
    return withPublicApiCors(
      NextResponse.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to process x402 checkout",
          },
        },
        { status: 500 },
      ),
    );
  }
}

function buildX402PaymentRequirements(
  orderId: string,
  totalUsd: number,
  resource: string,
): X402PaymentRequirements {
  const payTo = X402_PAY_TO_SOLANA || deriveDepositAddress(orderId);
  const amountBn = usdcAmountFromUsd(totalUsd);
  const amountBaseUnits = amountBn.toFixed(0);

  return {
    accepts: [
      {
        amount: amountBaseUnits,
        asset: USDC_MINT_MAINNET,
        extra: {
          memo: `FTC Order: ${orderId}`,
          orderId,
        },
        maxAmountRequired: amountBaseUnits,
        maxTimeoutSeconds: 300,
        payTo,
      },
    ],
    network: "solana",
    resource,
    scheme: "exact",
    x402Version: 1,
  };
}
