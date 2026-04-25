import { and, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "~/db";
import { productsTable } from "~/db/schema";
import { auth } from "~/lib/auth";
import { generateOrderConfirmationToken } from "~/lib/order-confirmation-token";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";
import { getStripe } from "~/lib/stripe";

const createCheckoutBodySchema = z.object({
  affiliateCode: z.string().max(64).optional(),
  /** Pre-serialized JSON from `getAttributionJsonForStripeMetadata()` (≤450 chars). */
  attribution: z.string().max(480).optional(),
  lineItems: z
    .array(
      z.object({
        productId: z.string().min(1),
        productVariantId: z.string().optional(),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1)
    .max(50),
  /** When "paypal", Stripe Checkout shows PayPal only. Omit for card. */
  paymentMethod: z.enum(["card", "paypal"]).optional(),
  userId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(
      `stripe-checkout:${ip}`,
      RATE_LIMITS.checkout,
    );
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const raw = await request.json();
    const parsed = createCheckoutBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          details: parsed.error.flatten().fieldErrors,
          error: "Invalid request body",
        },
        { status: 400 },
      );
    }
    const body = parsed.data;

    let session: Awaited<ReturnType<typeof auth.api.getSession>> = null;
    try {
      session = await auth.api.getSession({ headers: request.headers });
    } catch (sessionError) {
      // Schema drift can break session queries in shared envs. Continue as guest.
      console.error(
        "Stripe checkout-session session lookup failed; continuing as guest:",
        sessionError,
      );
      session = null;
    }
    const lineItems = body.lineItems;
    const validItems = lineItems.filter(
      (i) => i?.productId && typeof i.quantity === "number" && i.quantity >= 1,
    );
    const productIds = [...new Set(validItems.map((i) => i.productId))];
    if (productIds.length === 0) {
      return NextResponse.json(
        { error: "lineItems array with productId and quantity required" },
        { status: 400 },
      );
    }

    const products = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        priceCents: productsTable.priceCents,
      })
      .from(productsTable)
      .where(
        and(
          inArray(productsTable.id, productIds),
          eq(productsTable.published, true),
        ),
      );
    const productMap = new Map(products.map((p) => [p.id, p]));

    const orderItems: {
      name: string;
      priceCents: number;
      productId: string;
      productVariantId?: string;
      quantity: number;
    }[] = [];
    const stripeLineItems: {
      price_data: {
        currency: string;
        product_data: { name: string };
        unit_amount: number;
      };
      quantity: number;
    }[] = [];

    for (const item of validItems) {
      const product = productMap.get(item.productId);
      if (!product) continue;
      orderItems.push({
        name: product.name,
        priceCents: product.priceCents,
        productId: product.id,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
      });
      stripeLineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: product.name },
          unit_amount: product.priceCents,
        },
        quantity: item.quantity,
      });
    }

    const stripe = getStripe();
    const reqUrl = new URL(request.url);
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_SERVER_APP_URL ??
      `${reqUrl.protocol}//${reqUrl.host}`;

    if (orderItems.length === 0) {
      return NextResponse.json(
        { error: "No valid line items" },
        { status: 400 },
      );
    }

    const metadata: Record<string, string> = {
      orderItems: JSON.stringify(orderItems),
    };
    if (session?.user?.id && body.userId === session.user.id) {
      metadata.userId = session.user.id;
    }
    if (body.affiliateCode?.trim()) {
      metadata.affiliateCode = body.affiliateCode.trim();
    }
    if (body.attribution?.trim()) {
      metadata.attribution = body.attribution.trim();
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      cancel_url: `${baseUrl}/checkout/cancelled`,
      line_items: stripeLineItems,
      metadata,
      mode: "payment",
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      ...(parsed.data.paymentMethod === "paypal"
        ? { payment_method_types: ["paypal"] as const }
        : {}),
    });

    return NextResponse.json({
      confirmationToken: generateOrderConfirmationToken(checkoutSession.id),
      url: checkoutSession.url,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 503 },
      );
    }
    console.error("Stripe create-checkout-session error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
