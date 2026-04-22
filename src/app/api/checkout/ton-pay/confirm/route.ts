import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { onOrderCreated } from "~/lib/create-user-notification";
import { fulfillEsimOrder, hasEsimItems } from "~/lib/esim-fulfillment";
import {
  createAndConfirmPrintfulOrder,
  hasPrintfulItems,
} from "~/lib/printful-orders";
import {
  createAndConfirmPrintifyOrder,
  hasPrintifyItems,
} from "~/lib/printify-orders";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";
import { getTonWalletAddress } from "~/lib/ton-pay";
import { verifyTonTransfer } from "~/lib/ton-verify";

/**
 * Mark TON order as paid after verifying the transaction on chain.
 *
 * Verification uses TON Center's `/getTransactions` endpoint to find an
 * incoming transfer to the merchant wallet with a comment equal to the
 * orderId and value >= the amount we locked at create-order time.
 *
 * Refuses when: txHash missing, order cryptoAmount missing, TON_WALLET_ADDRESS
 * unset, TONCENTER_API_KEY unset, or no matching tx found yet.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(
      `ton-pay-confirm:${ip}`,
      RATE_LIMITS.checkout,
    );
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const body = (await request.json()) as {
      orderId?: string;
      txHash?: string;
    };
    const orderId = body?.orderId?.trim();
    const txHash = typeof body?.txHash === "string" ? body.txHash.trim() : "";

    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }
    if (!txHash) {
      return NextResponse.json(
        { error: "txHash required for payment verification" },
        { status: 400 },
      );
    }

    const [order] = await db
      .select({
        cryptoAmount: ordersTable.cryptoAmount,
        hasAmazonItems: ordersTable.hasAmazonItems,
        id: ordersTable.id,
        paymentMethod: ordersTable.paymentMethod,
        solanaPayDepositAddress: ordersTable.solanaPayDepositAddress,
        status: ordersTable.status,
        totalCents: ordersTable.totalCents,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.paymentMethod !== "ton_pay") {
      return NextResponse.json(
        { error: "Order is not a TON payment" },
        { status: 400 },
      );
    }
    if (order.status !== "pending") {
      return NextResponse.json({ alreadyPaid: true, orderId: order.id });
    }

    // verify the payment on chain before we flip the order to paid.
    const merchantWallet = getTonWalletAddress();
    if (!merchantWallet) {
      return NextResponse.json(
        { error: "TON payments are not configured (TON_WALLET_ADDRESS)" },
        { status: 503 },
      );
    }
    if (!order.cryptoAmount || order.cryptoAmount.trim() === "") {
      return NextResponse.json(
        {
          error:
            "Order is missing its server-locked TON amount. Please recreate the order.",
        },
        { status: 400 },
      );
    }
    // order.cryptoAmount is stored as a decimal TON string (e.g. "1.234"); convert
    // to nanotons (1 ton = 1e9 nanotons).
    const expectedTon = Number.parseFloat(order.cryptoAmount);
    if (!Number.isFinite(expectedTon) || expectedTon <= 0) {
      return NextResponse.json(
        { error: "Invalid server-locked TON amount" },
        { status: 400 },
      );
    }
    const expectedNanotons = BigInt(Math.floor(expectedTon * 1_000_000_000));

    const verify = await verifyTonTransfer({
      expectedNanotons,
      orderId: order.id,
      toAddress: merchantWallet,
      txHash,
    });
    if (!verify.ok) {
      return NextResponse.json(
        { error: verify.error ?? "TON transfer verification failed" },
        { status: 400 },
      );
    }
    const verifiedTxHash = verify.txHash ?? txHash;

    // Idempotent update: only transition from 'pending' to prevent double-fulfillment
    const updated = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ id: ordersTable.id, status: ordersTable.status })
        .from(ordersTable)
        .where(
          and(eq(ordersTable.id, order.id), eq(ordersTable.status, "pending")),
        )
        .limit(1);
      if (!current) return null; // already processed by a concurrent request
      await tx
        .update(ordersTable)
        .set({
          cryptoTxHash: verifiedTxHash,
          fulfillmentStatus: "unfulfilled",
          paymentStatus: "paid",
          status: "paid",
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, order.id));
      return current;
    });

    if (!updated) {
      return NextResponse.json({ alreadyPaid: true, orderId: order.id });
    }

    void onOrderCreated(order.id);

    let _printfulOrderId: number | undefined;
    let printfulError: string | undefined;
    try {
      const hasPrintful = await hasPrintfulItems(order.id);
      if (hasPrintful) {
        const printfulResult = await createAndConfirmPrintfulOrder(order.id);
        if (printfulResult.success)
          _printfulOrderId = printfulResult.printfulOrderId;
        else printfulError = printfulResult.error;
      }
    } catch (pfError) {
      printfulError =
        pfError instanceof Error ? pfError.message : "Unknown error";
    }

    let _printifyOrderId: string | undefined;
    let printifyError: string | undefined;
    try {
      const hasPrintify = await hasPrintifyItems(order.id);
      if (hasPrintify) {
        const printifyResult = await createAndConfirmPrintifyOrder(order.id);
        if (printifyResult.success)
          _printifyOrderId = printifyResult.printifyOrderId;
        else printifyError = printifyResult.error;
      }
    } catch (pyError) {
      printifyError =
        pyError instanceof Error ? pyError.message : "Unknown error";
    }

    let esimError: string | undefined;
    try {
      const hasEsim = await hasEsimItems(order.id);
      if (hasEsim) {
        const esimResult = await fulfillEsimOrder(order.id);
        if (!esimResult.success) esimError = esimResult.error;
      }
    } catch (eError) {
      esimError = eError instanceof Error ? eError.message : "Unknown error";
    }

    if (order.hasAmazonItems) {
      console.log(
        `Order ${order.id} contains marketplace items; fulfillment pending (manual or future automation).`,
      );
    }

    const fulfillmentError = [printfulError, printifyError, esimError]
      .filter(Boolean)
      .join("; ");
    return NextResponse.json({
      orderId: order.id,
      ...(fulfillmentError && { fulfillmentError }),
    });
  } catch (err) {
    console.error("TON Pay confirm error:", err);
    return NextResponse.json(
      { error: "Failed to confirm order" },
      { status: 500 },
    );
  }
}
