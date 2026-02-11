import { and, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "~/db";
import { productsTable } from "~/db/schema";
import { auth } from "~/lib/auth";
import {
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitResponse,
} from "~/lib/rate-limit";
import { getStripe } from "~/lib/stripe";

const createCheckoutBodySchema = z.object({
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
  userId: z.string().optional(),
  affiliateCode: z.string().max(64).optional(),
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
          error: "Invalid request body",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }
    const body = parsed.data;

    const session = await auth.api.getSession({ headers: request.headers });
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
      .where(and(inArray(productsTable.id, productIds), eq(productsTable.published, true)));
    const productMap = new Map(products.map((p) => [p.id, p]));

    const orderItems: {
      productId: string;
      productVariantId?: string;
      name: string;
      priceCents: number;
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
        productId: product.id,
        productVariantId: item.productVariantId,
        name: product.name,
        priceCents: product.priceCents,
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
    const baseUrl = process.env.NEXT_SERVER_APP_URL ?? "http://localhost:3000";

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

    const checkoutSession = await stripe.checkout.sessions.create({
      line_items: stripeLineItems,
      mode: "payment",
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/cancelled`,
      metadata,
    });

    return NextResponse.json({ url: checkoutSession.url });
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
