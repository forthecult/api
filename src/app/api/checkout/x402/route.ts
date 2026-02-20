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
import { USDC_MINT_MAINNET, usdcAmountFromUsd } from "~/lib/solana-pay";

const PAYMENT_WINDOW_MS = 60 * 60 * 1000;

const X402_PAY_TO_SOLANA = process.env.X402_PAY_TO_SOLANA_ADDRESS?.trim();
const X402_FACILITATOR = process.env.X402_FACILITATOR_URL?.trim() || "https://x402.org/facilitator";

type CheckoutItem =
  | { productId: string; quantity: number }
  | { asin: string; quantity: number };

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

interface X402PaymentRequirements {
  x402Version: number;
  scheme: string;
  network: string;
  resource: string;
  accepts: Array<{
    maxAmountRequired: string;
    amount: string;
    payTo: string;
    asset: string;
    maxTimeoutSeconds: number;
    extra?: {
      feePayer?: string;
      orderId?: string;
      memo?: string;
    };
  }>;
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
    x402Version: 1,
    scheme: "exact",
    network: "solana",
    resource,
    accepts: [
      {
        maxAmountRequired: amountBaseUnits,
        amount: amountBaseUnits,
        payTo,
        asset: USDC_MINT_MAINNET,
        maxTimeoutSeconds: 300,
        extra: {
          orderId,
          memo: `FTC Order: ${orderId}`,
        },
      },
    ],
  };
}

/**
 * x402 autonomous checkout endpoint.
 * POST /api/checkout/x402
 *
 * Flow:
 * 1. Agent POSTs order details (no payment header) → returns 402 with payment requirements
 * 2. Agent builds USDC transfer transaction with memo "FTC Order: {orderId}"
 * 3. Agent retries with X-PAYMENT header containing signed transaction
 * 4. Server verifies/settles via facilitator, creates order
 *
 * This enables fully autonomous agent shopping with USDC on Solana.
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
      if (!product || !product.published) continue;
      orderItems.push({
        name: product.name,
        priceCents: product.priceCents,
        quantity: item.quantity,
        productId: product.id,
        source: "store",
      });
    }

    let amazonProductMap = new Map<
      string,
      { name: string; price: { usd: number }; productUrl: string; imageUrl?: string }
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
            code: "PAYMENT_REQUIRED",
            message: `Payment required: send ${totalUsd.toFixed(2)} USDC to complete order`,
            orderId,
            totals: {
              subtotalUsd,
              shippingUsd: 0,
              totalUsd,
            },
            paymentInstructions: {
              protocol: "x402",
              network: "solana",
              token: "USDC",
              tokenMint: USDC_MINT_MAINNET,
              amount: paymentRequirements.accepts[0]?.amount,
              amountHuman: totalUsd.toFixed(2),
              payTo: paymentRequirements.accepts[0]?.payTo,
              memo: `FTC Order: ${orderId}`,
              maxTimeoutSeconds: 300,
            },
            _x402: paymentRequirements,
            _actions: {
              next: `Sign a USDC transfer transaction and retry with X-PAYMENT header`,
              documentation: "https://x402.org/docs",
            },
          },
          {
            status: 402,
            headers: {
              ...getRateLimitHeaders(rateLimitResult, RATE_LIMITS.checkout.limit),
              "PAYMENT-REQUIRED": paymentRequiredBase64,
              "WWW-Authenticate": `x402 scheme="exact" network="solana"`,
            },
          },
        ),
      );
    }

    let paymentPayload: { transaction?: string; signature?: string } = {};
    try {
      const parsed = JSON.parse(
        Buffer.from(paymentHeader, "base64").toString("utf8"),
      ) as { transaction?: string; signature?: string };
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

    const { transaction: signedTx, signature: txSignature } = paymentPayload;
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
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentPayload: {
              x402Version: 1,
              scheme: "exact",
              network: "solana",
              payload: { transaction: signedTx },
            },
            paymentRequirements: buildX402PaymentRequirements(
              orderId,
              totalUsd,
              resource,
            ).accepts[0],
          }),
        });

        const verifyResult = (await verifyResponse.json()) as {
          isValid: boolean;
          invalidReason?: string;
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
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentPayload: {
              x402Version: 1,
              scheme: "exact",
              network: "solana",
              payload: { transaction: signedTx },
            },
            paymentRequirements: buildX402PaymentRequirements(
              orderId,
              totalUsd,
              resource,
            ).accepts[0],
          }),
        });

        const settleResult = (await settleResponse.json()) as {
          success: boolean;
          transaction?: string;
          errorReason?: string;
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
      paymentMethod: "x402_usdc",
      paymentStatus: "paid",
      shippingFeeCents,
      solanaPayDepositAddress: depositAddress,
      cryptoTxHash: transactionSignature,
      cryptoCurrency: "USDC",
      cryptoCurrencyNetwork: "Solana",
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
          success: true,
          orderId,
          status: "paid",
          payment: {
            method: "x402_usdc",
            network: "solana",
            token: "USDC",
            transactionSignature,
          },
          totals: {
            subtotalUsd,
            shippingUsd: 0,
            totalUsd,
          },
          _actions: {
            next: "Order is paid and processing",
            status: `/api/orders/${orderId}/status`,
            details: `/api/orders/${orderId}`,
          },
        },
        {
          status: 201,
          headers: getRateLimitHeaders(
            rateLimitResult,
            RATE_LIMITS.checkout.limit,
          ),
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
