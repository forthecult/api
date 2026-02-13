import { createId } from "@paralleldrive/cuid2";
import { NextResponse } from "next/server";

import { getCurrentUser } from "~/lib/auth";
import { db } from "~/db";
import { esimOrdersTable } from "~/db/schema";
import {
  getEsimPackageDetail,
  purchaseEsimDataVoiceSms,
  purchaseEsimPackage,
} from "~/lib/esim-api";

type PurchaseBody = {
  packageId: string;
  packageType?: "DATA-ONLY" | "DATA-VOICE-SMS";
  imei?: string;
};

/**
 * POST /api/esim/purchase
 * Purchase an eSIM package for the authenticated user.
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
    const { packageId, packageType = "DATA-ONLY", imei } = body;

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

    // Purchase from eSIM Card API
    let purchaseResult;
    if (packageType === "DATA-VOICE-SMS") {
      purchaseResult = await purchaseEsimDataVoiceSms(packageId, imei);
    } else {
      purchaseResult = await purchaseEsimPackage(packageId, imei);
    }

    if (!purchaseResult.status) {
      return NextResponse.json(
        { status: false, message: "Purchase failed with eSIM provider" },
        { status: 502 },
      );
    }

    // Extract eSIM details from purchase result
    const purchaseData = purchaseResult.data as Record<string, unknown>;
    const sim = purchaseData.sim as
      | { id: string; iccid: string; status: string }
      | undefined;
    const esimId = sim?.id ?? (purchaseData.id as string) ?? null;
    const iccid = sim?.iccid ?? null;
    const esimStatus = sim
      ? "active"
      : (purchaseData.sim_applied as boolean)
        ? "active"
        : "processing";

    // Determine country name from package details
    const countryName =
      pkg.countries?.[0]?.name ??
      pkg.romaing_countries?.[0]?.name ??
      null;

    const now = new Date();
    const orderId = createId();

    // Save to our database
    await db.insert(esimOrdersTable).values({
      id: orderId,
      userId: user.id,
      esimId,
      iccid,
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
      paymentMethod: "balance", // Deducted from reseller balance
      paymentStatus: "paid",
      status: esimStatus,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      status: true,
      data: {
        orderId,
        esimId,
        iccid,
        status: esimStatus,
        packageName: pkg.name,
        message:
          esimStatus === "processing"
            ? "Your eSIM has been purchased and is being prepared. Please check back in a few minutes."
            : "Your eSIM is ready! Check your dashboard for installation instructions.",
      },
    });
  } catch (error) {
    console.error("eSIM purchase error:", error);
    return NextResponse.json(
      { status: false, message: "Failed to purchase eSIM" },
      { status: 500 },
    );
  }
}
