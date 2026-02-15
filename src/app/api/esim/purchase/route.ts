import { createId } from "@paralleldrive/cuid2";
import { NextResponse } from "next/server";

import { getCurrentUser } from "~/lib/auth";
import { db } from "~/db";
import { esimOrdersTable, ordersTable, orderItemsTable } from "~/db/schema";
import { getEsimPackageDetail } from "~/lib/esim-api";

type PurchaseBody = {
  packageId: string;
  packageType?: "DATA-ONLY" | "DATA-VOICE-SMS";
  paymentMethod: string; // "stripe" | "solana_pay" | "eth_pay" | "btcpay" | "ton_pay"
  /** Required when not authenticated (guest checkout). */
  email?: string;
};

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
      packageId,
      packageType = "DATA-ONLY",
      paymentMethod = "stripe",
      email: bodyEmail,
    } = body;

    if (!packageId) {
      return NextResponse.json(
        { status: false, message: "packageId is required" },
        { status: 400 },
      );
    }

    const email = (user?.email ?? bodyEmail?.trim()) || null;
    if (!email) {
      return NextResponse.json(
        { status: false, message: "Email is required for guest checkout" },
        { status: 400 },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { status: false, message: "Please enter a valid email address" },
        { status: 400 },
      );
    }

    // Fetch package details to get pricing and info
    const pkgResult = await getEsimPackageDetail(packageId);
    if (!pkgResult.status || !pkgResult.data) {
      return NextResponse.json(
        { status: false, message: "Package not found" },
        { status: 404 },
      );
    }

    const pkg = pkgResult.data;
    const markup = Number(process.env.ESIM_MARKUP_PERCENT) || 30;
    const costCents = Math.round(Number(pkg.price) * 100);
    const priceCents = Math.round(costCents * (1 + markup / 100));

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
      id: orderId,
      createdAt: now,
      email: email.toLowerCase(),
      fulfillmentStatus: "unfulfilled",
      paymentMethod,
      paymentStatus: "pending",
      status: "pending",
      totalCents: priceCents,
      shippingFeeCents: 0,
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
      id: esimOrderId,
      userId: user?.id ?? null,
      orderId,
      packageId,
      packageName: String(pkg.name ?? "eSIM"),
      packageType: packageTypeVal,
      dataQuantity: Number.isNaN(dataQuantity) ? 0 : dataQuantity,
      dataUnit,
      validityDays,
      countryName,
      costCents,
      priceCents,
      currency: "USD",
      paymentMethod,
      paymentStatus: "pending",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      status: true,
      data: {
        orderId,
        esimOrderId,
        priceCents,
        priceUsd: (priceCents / 100).toFixed(2),
        packageName: pkg.name,
        paymentMethod,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("eSIM purchase error:", message, error);
    return NextResponse.json(
      {
        status: false,
        message: "Failed to create eSIM order",
        ...(process.env.NODE_ENV === "development" && { detail: message }),
      },
      { status: 500 },
    );
  }
}
