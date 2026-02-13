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
};

/**
 * POST /api/esim/purchase
 *
 * Creates a pending order + eSIM order record for the authenticated user.
 * Returns the orderId so the frontend can route to the appropriate payment
 * flow (Stripe checkout, Solana Pay, etc.). The eSIM is NOT provisioned
 * until payment is confirmed via webhook / confirm endpoint.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { status: false, message: "Authentication required" },
        { status: 401 },
      );
    }

    const body = (await request.json()) as PurchaseBody;
    const { packageId, packageType = "DATA-ONLY", paymentMethod = "stripe" } = body;

    if (!packageId) {
      return NextResponse.json(
        { status: false, message: "packageId is required" },
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

    // Determine country name from package details
    const countryName =
      pkg.countries?.[0]?.name ??
      pkg.romaing_countries?.[0]?.name ??
      null;

    const now = new Date();
    const orderId = createId();
    const esimOrderId = createId();
    const orderItemId = createId();

    // Create a main order (same pattern as physical product orders)
    await db.insert(ordersTable).values({
      id: orderId,
      createdAt: now,
      email: user.email ?? "guest@checkout.local",
      fulfillmentStatus: "unfulfilled",
      paymentMethod,
      paymentStatus: "pending",
      status: "pending",
      totalCents: priceCents,
      shippingFeeCents: 0,
      updatedAt: now,
      userId: user.id,
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
      userId: user.id,
      orderId,
      packageId,
      packageName: pkg.name,
      packageType,
      dataQuantity: pkg.data_quantity,
      dataUnit: pkg.data_unit,
      validityDays: pkg.package_validity,
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
    console.error("eSIM purchase error:", error);
    return NextResponse.json(
      { status: false, message: "Failed to create eSIM order" },
      { status: 500 },
    );
  }
}
