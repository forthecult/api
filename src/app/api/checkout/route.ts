import { createId } from "@paralleldrive/cuid2";
import { Connection, PublicKey } from "@solana/web3.js";
import BigNumber from "bignumber.js";
import { eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { orderItemsTable, ordersTable, productsTable } from "~/db/schema";
import { subscriptionPlanTable } from "~/db/schema/subscription-catalog/tables";
import {
  getAmazonProducts,
  isAmazonProductApiConfigured,
} from "~/lib/amazon-product-api";
import { auth } from "~/lib/auth";
import { getCoinGeckoSimplePrice } from "~/lib/coingecko";
import {
  publicApiCorsPreflight,
  withPublicApiCors,
} from "~/lib/cors-public-api";
import { getOptionalMoltbookAgentFromRequest } from "~/lib/moltbook-auth";
import { getPumpTokenPriceInSol } from "~/lib/pump-price";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";
import { deriveDepositAddress } from "~/lib/solana-deposit";
import {
  CULT_MINT_MAINNET,
  getSolanaPayLabel,
  getSolanaRpcUrlServer,
  tokenAmountFromUsdWithPrice,
  USDC_MINT_MAINNET,
  usdcAmountFromUsd,
} from "~/lib/solana-pay";

const CULT_DECIMALS = 6;
const LAMPORTS_PER_SOL = 1e9;
const SOL_USD_FALLBACK = 200;

const PAYMENT_WINDOW_MS = 60 * 60 * 1000;

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
  subscriptionPlanId?: string;
}

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
    const subscriptionPlanId =
      typeof body.subscriptionPlanId === "string"
        ? body.subscriptionPlanId.trim()
        : undefined;
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
    const paymentToken =
      payment.token === "SOL"
        ? "SOL"
        : payment.token === "CULT"
          ? "CULT"
          : payment.token;
    if (
      paymentToken !== "USDC" &&
      paymentToken !== "SOL" &&
      paymentToken !== "CULT"
    ) {
      return withPublicApiCors(
        NextResponse.json(
          {
            error: {
              code: "INVALID_REQUEST",
              message:
                "payment.token must be 'SOL', 'USDC', or 'CULT' for Solana checkout",
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

    if (subscriptionPlanId) {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session?.user?.id) {
        return withPublicApiCors(
          NextResponse.json(
            {
              error: {
                code: "UNAUTHORIZED",
                message: "Sign in required for subscription checkout",
              },
            },
            { status: 401 },
          ),
        );
      }
      const [subPlan] = await db
        .select()
        .from(subscriptionPlanTable)
        .where(eq(subscriptionPlanTable.id, subscriptionPlanId))
        .limit(1);
      if (
        !subPlan?.published ||
        !subPlan.payCryptoManual ||
        !subPlan.cryptoProductId
      ) {
        return withPublicApiCors(
          NextResponse.json(
            {
              error: {
                code: "INVALID_REQUEST",
                message: "Invalid subscription plan for crypto checkout",
              },
            },
            { status: 400 },
          ),
        );
      }
      if (
        orderItems.length !== 1 ||
        orderItems[0]?.productId !== subPlan.cryptoProductId ||
        orderItems[0]?.quantity !== 1
      ) {
        return withPublicApiCors(
          NextResponse.json(
            {
              error: {
                code: "INVALID_REQUEST",
                message:
                  "Items must be a single line for the plan crypto product with quantity 1",
              },
            },
            { status: 400 },
          ),
        );
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

    const subscriptionSession = subscriptionPlanId
      ? await auth.api.getSession({ headers: request.headers })
      : null;

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
      ...(subscriptionPlanId && { subscriptionPlanId }),
      ...(subscriptionSession?.user?.id && {
        userId: subscriptionSession.user.id,
      }),
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

    const _label = getSolanaPayLabel();
    const message = "Thank you for your order.";

    let amountBaseUnits: string;
    let decimals: number;

    if (paymentToken === "SOL") {
      const cg = await getCoinGeckoSimplePrice(["solana"]);
      const solUsd =
        typeof cg?.solana?.usd === "number" && cg.solana.usd > 0
          ? cg.solana.usd
          : SOL_USD_FALLBACK;
      const lamports = Math.ceil((totalUsd / solUsd) * LAMPORTS_PER_SOL);
      amountBaseUnits = String(lamports);
      decimals = 9;
    } else if (paymentToken === "CULT") {
      const [cg, cultSolPerToken] = await Promise.all([
        getCoinGeckoSimplePrice(["solana"]),
        (async () => {
          const connection = new Connection(getSolanaRpcUrlServer());
          return getPumpTokenPriceInSol(
            connection,
            new PublicKey(CULT_MINT_MAINNET),
          );
        })(),
      ]);
      const solUsd =
        typeof cg?.solana?.usd === "number" && cg.solana.usd > 0
          ? cg.solana.usd
          : SOL_USD_FALLBACK;
      const amountBn = tokenAmountFromUsdWithPrice(
        totalUsd,
        cultSolPerToken > 0 ? cultSolPerToken : 1e-9,
        solUsd,
        CULT_DECIMALS,
      );
      amountBaseUnits = amountBn.integerValue(BigNumber.ROUND_CEIL).toFixed(0);
      decimals = CULT_DECIMALS;
    } else {
      amountBaseUnits = usdcAmountFromUsd(totalUsd).toFixed(0);
      decimals = 6;
    }

    const params = new URLSearchParams();
    params.set("amount", amountBaseUnits);
    if (paymentToken === "USDC") params.set("spl-token", USDC_MINT_MAINNET);
    else if (paymentToken === "CULT")
      params.set("spl-token", CULT_MINT_MAINNET);
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
            token: paymentToken,
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
