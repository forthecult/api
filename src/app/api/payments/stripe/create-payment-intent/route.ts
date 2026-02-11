import { createId } from "@paralleldrive/cuid2";
import { and, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "~/db";
import { orderItemsTable, ordersTable, productsTable } from "~/db/schema";
import { auth } from "~/lib/auth";
import {
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitResponse,
} from "~/lib/rate-limit";
import { resolveAffiliateForOrder } from "~/lib/affiliate";
import { getStripe } from "~/lib/stripe";

const createPaymentIntentBodySchema = z.object({
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
  email: z.string().email(),
  userId: z.string().optional(),
  affiliateCode: z.string().max(64).optional(),
  shipping: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      address1: z.string().optional(),
      address2: z.string().optional(),
      city: z.string().optional(),
      stateCode: z.string().optional(),
      countryCode: z.string().optional(),
      zip: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(
      `stripe-payment-intent:${ip}`,
      RATE_LIMITS.checkout,
    );
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const raw = await request.json();
    const parsed = createPaymentIntentBodySchema.safeParse(raw);
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
    const lineItems = body.lineItems.filter(
      (i) => i?.productId && typeof i.quantity === "number" && i.quantity >= 1,
    );
    const productIds = [...new Set(lineItems.map((i) => i.productId))];
    if (productIds.length === 0) {
      return NextResponse.json(
        { error: "lineItems with productId and quantity required" },
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
      productId: string;
      productVariantId?: string;
      name: string;
      priceCents: number;
      quantity: number;
    }[] = [];

    for (const item of lineItems) {
      const product = productMap.get(item.productId);
      if (!product) continue;
      orderItems.push({
        productId: product.id,
        productVariantId: item.productVariantId,
        name: product.name,
        priceCents: product.priceCents,
        quantity: item.quantity,
      });
    }

    if (orderItems.length === 0) {
      return NextResponse.json(
        { error: "No valid line items" },
        { status: 400 },
      );
    }

    const subtotalCents = orderItems.reduce(
      (sum, i) => sum + i.priceCents * i.quantity,
      0,
    );
    const affiliateResult = await resolveAffiliateForOrder(
      body.affiliateCode?.trim() || undefined,
      subtotalCents,
      0,
    );
    const totalCents =
      affiliateResult?.totalAfterDiscountCents ?? subtotalCents;

    const orderId = createId();
    const now = new Date();
    const userId =
      session?.user?.id && body.userId === session.user.id
        ? session.user.id
        : null;

    const shippingName =
      body.shipping?.firstName || body.shipping?.lastName
        ? [body.shipping.firstName, body.shipping.lastName]
            .filter(Boolean)
            .join(" ")
        : null;

    await db.insert(ordersTable).values({
      id: orderId,
      createdAt: now,
      updatedAt: now,
      email: body.email.trim(),
      userId,
      status: "pending",
      paymentStatus: "pending",
      fulfillmentStatus: "unfulfilled",
      totalCents,
      paymentMethod: "stripe",
      ...(body.shipping?.address1 && { shippingAddress1: body.shipping.address1.trim() }),
      ...(body.shipping?.address2 && { shippingAddress2: body.shipping.address2.trim() }),
      ...(body.shipping?.city && { shippingCity: body.shipping.city.trim() }),
      ...(body.shipping?.stateCode && { shippingStateCode: body.shipping.stateCode.trim() }),
      ...(body.shipping?.countryCode && { shippingCountryCode: body.shipping.countryCode.trim() }),
      ...(body.shipping?.zip && { shippingZip: body.shipping.zip.trim() }),
      ...(body.shipping?.phone && { shippingPhone: body.shipping.phone.trim() }),
      ...(shippingName && { shippingName }),
      ...(affiliateResult && {
        affiliateId: affiliateResult.affiliate.affiliateId,
        affiliateCode: affiliateResult.affiliate.affiliateCode,
        affiliateCommissionCents: affiliateResult.affiliate.commissionCents,
        affiliateDiscountCents: affiliateResult.affiliate.discountCents,
      }),
    });

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

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: { orderId },
    });

    const clientSecret = paymentIntent.client_secret;
    if (!clientSecret) {
      return NextResponse.json(
        { error: "Failed to create payment intent" },
        { status: 500 },
      );
    }

    return NextResponse.json({ clientSecret, orderId });
  } catch (err) {
    if (err instanceof Error && err.message.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 503 },
      );
    }
    console.error("Stripe create-payment-intent error:", err);
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 },
    );
  }
}
