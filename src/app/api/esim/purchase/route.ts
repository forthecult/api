import { createId } from "@paralleldrive/cuid2";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { esimOrdersTable, orderItemsTable, ordersTable } from "~/db/schema";
import { getCurrentUser } from "~/lib/auth";
import {
  CouponExhaustedError,
  postOrderBookkeeping,
} from "~/lib/checkout/create-order-helpers";
import { resolveAutomaticCouponForCheckout } from "~/lib/coupon";
import { getEsimPackageDetail } from "~/lib/esim-api";

interface PurchaseBody {
  /** Required when not authenticated (guest checkout). */
  email?: string;
  packageId: string;
  packageType?: "DATA-ONLY" | "DATA-VOICE-SMS";
  paymentMethod: string; // "stripe" | "solana_pay" | "eth_pay" | "btcpay" | "ton_pay"
  /** Payment method key for discount resolution (e.g. crypto_seeker). Sent when paying with a specific crypto so automatic coupons can apply. */
  paymentMethodKey?: null | string;
}

/**
 * POST /api/esim/purchase
 *
 * Creates a pending order + eSIM order record. No auth required: if the user
 * is logged in we use their userId and email; if not, email is required in the body.
 * Returns the orderId for the payment flow. The eSIM is NOT provisioned
 * until payment is confirmed via webhook / confirm endpoint.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const body = (await request.json()) as PurchaseBody;
    const {
      email: bodyEmail,
      packageId,
      packageType: _packageType = "DATA-ONLY",
      paymentMethod = "stripe",
      paymentMethodKey: bodyPaymentMethodKey,
    } = body;

    if (!packageId) {
      return NextResponse.json(
        { message: "packageId is required", status: false },
        { status: 400 },
      );
    }

    const email = (user?.email ?? bodyEmail?.trim()) || null;
    if (!email) {
      return NextResponse.json(
        { message: "Email is required for guest checkout", status: false },
        { status: 400 },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { message: "Please enter a valid email address", status: false },
        { status: 400 },
      );
    }

    // Fetch package details to get pricing and info
    const pkgResult = await getEsimPackageDetail(packageId);
    if (!pkgResult.status || !pkgResult.data) {
      return NextResponse.json(
        { message: "Package not found", status: false },
        { status: 404 },
      );
    }

    const pkg = pkgResult.data;
    const markup = Number(process.env.ESIM_MARKUP_PERCENT) || 30;
    const costCents = Math.round(Number(pkg.price) * 100);
    const priceCents = Math.round(costCents * (1 + markup / 100));

    // Resolve automatic coupon (e.g. 5% eSIM discount when paying with Seeker)
    const paymentMethodKey = bodyPaymentMethodKey?.trim() || null;
    let orderTotalCents = priceCents;
    let couponResult: Awaited<
      ReturnType<typeof resolveAutomaticCouponForCheckout>
    > = null;
    if (paymentMethodKey) {
      const productId = `esim_${packageId}`;
      const automaticResult = await resolveAutomaticCouponForCheckout({
        items: [{ priceCents, productId, quantity: 1 }],
        paymentMethodKey,
        productCount: 1,
        productIds: [productId],
        shippingFeeCents: 0,
        subtotalCents: priceCents,
        userId: user?.id ?? undefined,
      });
      if (automaticResult) {
        orderTotalCents = automaticResult.totalAfterDiscountCents;
        couponResult = automaticResult;
      }
    }

    // Coerce API values (external API may return strings or omit fields)
    const dataQuantity = Number(pkg.data_quantity);
    const validityDays = Number(pkg.package_validity) || 1;
    const dataUnit =
      (pkg.data_unit && String(pkg.data_unit).toUpperCase()) === "MB"
        ? "MB"
        : "GB";
    const packageTypeVal = (
      pkg.package_type === "DATA-VOICE-SMS" ? "DATA-VOICE-SMS" : "DATA-ONLY"
    ) as "DATA-ONLY" | "DATA-VOICE-SMS";

    // Determine country name from package details
    const countryName =
      pkg.countries?.[0]?.name ?? pkg.romaing_countries?.[0]?.name ?? null;

    const now = new Date();
    const orderId = createId();
    const esimOrderId = createId();
    const orderItemId = createId();

    // Create a main order (same pattern as physical product orders)
    await db.insert(ordersTable).values({
      createdAt: now,
      email: email.toLowerCase(),
      fulfillmentStatus: "unfulfilled",
      id: orderId,
      paymentMethod,
      paymentStatus: "pending",
      shippingFeeCents: 0,
      status: "pending",
      totalCents: orderTotalCents,
      updatedAt: now,
      userId: user?.id ?? null,
    });

    // Create an order item (so it shows in order details like physical products)
    await db.insert(orderItemsTable).values({
      id: orderItemId,
      name: `eSIM: ${pkg.name}`,
      orderId,
      priceCents,
      productId: null, // Virtual product — no productsTable entry
      quantity: 1,
    });

    // Create the eSIM-specific order record (pending until payment confirmed)
    await db.insert(esimOrdersTable).values({
      costCents,
      countryName,
      createdAt: now,
      currency: "USD",
      dataQuantity: Number.isNaN(dataQuantity) ? 0 : dataQuantity,
      dataUnit,
      id: esimOrderId,
      orderId,
      packageId,
      packageName: String(pkg.name ?? "eSIM"),
      packageType: packageTypeVal,
      paymentMethod,
      paymentStatus: "pending",
      priceCents,
      status: "pending",
      updatedAt: now,
      userId: user?.id ?? null,
      validityDays,
    });

    // Record coupon redemption when an automatic discount was applied
    if (couponResult) {
      await postOrderBookkeeping({
        affiliateResult: null,
        couponResult,
        orderId,
        userId: user?.id ?? null,
      });
    }

    return NextResponse.json({
      data: {
        esimOrderId,
        orderId,
        packageName: pkg.name,
        paymentMethod,
        priceCents: orderTotalCents,
        priceUsd: (orderTotalCents / 100).toFixed(2),
      },
      status: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("eSIM purchase error:", message, error);
    if (error instanceof CouponExhaustedError) {
      return NextResponse.json(
        { message: error.message, status: false },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        message: "Failed to create eSIM order",
        status: false,
        ...(process.env.NODE_ENV === "development" && { detail: message }),
      },
      { status: 500 },
    );
  }
}
