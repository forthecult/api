import { validateTransfer } from "@solana/pay";
import {
  Connection,
  PublicKey,
  SystemInstruction,
  SystemProgram,
  TransactionMessage,
} from "@solana/web3.js";
import BigNumber from "bignumber.js";
import { type NextRequest, NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { onOrderCreated } from "~/lib/create-user-notification";
import {
  createAndConfirmPrintfulOrder,
  hasPrintfulItems,
} from "~/lib/printful-orders";
import {
  createAndConfirmPrintifyOrder,
  hasPrintifyItems,
} from "~/lib/printify-orders";
import {
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitResponse,
} from "~/lib/rate-limit";
import {
  getSolanaRpcUrlServer,
  USDC_MINT_MAINNET,
  CRUST_MINT_MAINNET,
  PUMP_MINT_MAINNET,
  TROLL_MINT_MAINNET,
  WHITEWHALE_MINT_MAINNET,
} from "~/lib/solana-pay";

const NATIVE_SOL_SENTINEL = "native";

/** Verify that the given signature is a native SOL transfer to depositAddress with at least expectedLamports. */
async function verifyNativeSolTransfer(
  connection: Connection,
  signature: string,
  depositAddress: PublicKey,
  expectedLamports: number,
): Promise<boolean> {
  const tx = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx?.transaction?.message) return false;
  const message = tx.transaction.message as Parameters<
    typeof TransactionMessage.decompile
  >[0];
  const txMessage = TransactionMessage.decompile(message);
  for (const ix of txMessage.instructions) {
    if (!ix.programId.equals(SystemProgram.programId)) continue;
    try {
      const decoded = SystemInstruction.decodeTransfer(ix);
      if (
        decoded.toPubkey.equals(depositAddress) &&
        decoded.lamports >= expectedLamports
      ) {
        return true;
      }
    } catch {
      // not a transfer instruction
    }
  }
  return false;
}

/**
 * Mark order as paid only after verifying the Solana transfer on-chain.
 * Requires signature + amount (and optional splToken) so we never trust client for payment.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rateLimitResult = await checkRateLimit(
    `solana-pay-confirm:${ip}`,
    RATE_LIMITS.checkout,
  );
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const body = (await request.json()) as {
      depositAddress?: string;
      orderId?: string;
      reference?: string;
      signature?: string;
      amount?: string;
      splToken?: string;
      /** Payer wallet address (from connected wallet) so we can link order to user when they sign up later */
      payerWalletAddress?: string;
    };
    const {
      depositAddress,
      orderId,
      reference,
      signature,
      amount,
      splToken,
      payerWalletAddress: payerWalletFromBody,
    } = body;

    const byDeposit =
      depositAddress &&
      typeof depositAddress === "string" &&
      depositAddress.trim()
        ? eq(ordersTable.solanaPayDepositAddress, depositAddress.trim())
        : undefined;
    const byOrderId =
      orderId && typeof orderId === "string" && orderId.trim()
        ? eq(ordersTable.id, orderId.trim())
        : undefined;
    const byReference =
      reference && typeof reference === "string" && reference.trim()
        ? eq(ordersTable.solanaPayReference, reference.trim())
        : undefined;

    const conditions = [byDeposit, byOrderId, byReference].filter(Boolean);
    if (conditions.length === 0) {
      return NextResponse.json(
        { error: "depositAddress, orderId, or reference required" },
        { status: 400 },
      );
    }

    const [order] = await db
      .select({
        id: ordersTable.id,
        status: ordersTable.status,
        solanaPayDepositAddress: ordersTable.solanaPayDepositAddress,
      })
      .from(ordersTable)
      .where(or(...conditions))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.status !== "pending") {
      return NextResponse.json({ orderId: order.id, alreadyPaid: true });
    }

    const depositAddressStr = order.solanaPayDepositAddress ?? depositAddress;
    if (!depositAddressStr?.trim()) {
      return NextResponse.json(
        { error: "Order has no deposit address" },
        { status: 400 },
      );
    }

    // Require signature + amount so we verify on-chain (no trust of client)
    const sigTrim = typeof signature === "string" ? signature.trim() : "";
    const amountStr = typeof amount === "string" ? amount.trim() : "";
    if (!sigTrim || !amountStr) {
      return NextResponse.json(
        {
          error:
            "signature and amount required (server verifies transfer on-chain)",
        },
        { status: 400 },
      );
    }

    const isNativeSol = splToken === NATIVE_SOL_SENTINEL;
    const splTokenMint =
      splToken === NATIVE_SOL_SENTINEL
        ? USDC_MINT_MAINNET
        : splToken === WHITEWHALE_MINT_MAINNET
          ? WHITEWHALE_MINT_MAINNET
          : splToken === CRUST_MINT_MAINNET
            ? CRUST_MINT_MAINNET
            : splToken === PUMP_MINT_MAINNET
              ? PUMP_MINT_MAINNET
              : splToken === TROLL_MINT_MAINNET
                ? TROLL_MINT_MAINNET
                : USDC_MINT_MAINNET;

    try {
      const connection = new Connection(getSolanaRpcUrlServer(), {
        commitment: "confirmed",
      });
      const depositPk = new PublicKey(depositAddressStr);
      const amountBn = new BigNumber(amountStr);
      if (isNativeSol) {
        const expectedLamports = amountBn.integerValue().toNumber();
        const valid = await verifyNativeSolTransfer(
          connection,
          sigTrim,
          depositPk,
          expectedLamports,
        );
        if (!valid) {
          return NextResponse.json(
            { error: "Transfer verification failed (native SOL)" },
            { status: 400 },
          );
        }
      } else {
        await validateTransfer(connection, sigTrim, {
          recipient: depositPk,
          amount: amountBn,
          splToken: new PublicKey(splTokenMint),
        });
      }
    } catch (verifyErr) {
      return NextResponse.json(
        {
          error:
            verifyErr instanceof Error
              ? verifyErr.message
              : "Transfer verification failed",
        },
        { status: 400 },
      );
    }

    await db
      .update(ordersTable)
      .set({
        fulfillmentStatus: "unfulfilled",
        paymentStatus: "paid",
        status: "paid",
        updatedAt: new Date(),
        ...(typeof payerWalletFromBody === "string" &&
        payerWalletFromBody.trim()
          ? { payerWalletAddress: payerWalletFromBody.trim() }
          : {}),
      })
      .where(eq(ordersTable.id, order.id));

    void onOrderCreated(order.id);

    // Send to Printful if order contains Printful items
    let printfulOrderId: number | undefined;
    let printfulError: string | undefined;

    try {
      const hasPrintful = await hasPrintfulItems(order.id);
      if (hasPrintful) {
        console.log(
          `Order ${order.id} has Printful items, creating Printful order...`,
        );
        const printfulResult = await createAndConfirmPrintfulOrder(order.id);
        if (printfulResult.success) {
          printfulOrderId = printfulResult.printfulOrderId;
          console.log(`Printful order created: ${printfulOrderId}`);
        } else {
          printfulError = printfulResult.error;
          console.error(`Failed to create Printful order: ${printfulError}`);
        }
      }
    } catch (pfError) {
      console.error("Error processing Printful order:", pfError);
      printfulError =
        pfError instanceof Error ? pfError.message : "Unknown error";
    }

    // Send to Printify if order contains Printify items
    let printifyOrderId: string | undefined;
    let printifyError: string | undefined;

    try {
      const hasPrintify = await hasPrintifyItems(order.id);
      if (hasPrintify) {
        console.log(
          `Order ${order.id} has Printify items, creating Printify order...`,
        );
        const printifyResult = await createAndConfirmPrintifyOrder(order.id);
        if (printifyResult.success) {
          printifyOrderId = printifyResult.printifyOrderId;
          console.log(`Printify order created: ${printifyOrderId}`);
        } else {
          printifyError = printifyResult.error;
          console.error(`Failed to create Printify order: ${printifyError}`);
        }
      }
    } catch (pyError) {
      console.error("Error processing Printify order:", pyError);
      printifyError =
        pyError instanceof Error ? pyError.message : "Unknown error";
    }

    const fulfillmentError = [printfulError, printifyError]
      .filter(Boolean)
      .join("; ");
    return NextResponse.json({
      orderId: order.id,
      ...(fulfillmentError && { fulfillmentError }),
    });
  } catch (err) {
    console.error("Solana Pay confirm error:", err);
    return NextResponse.json(
      { error: "Failed to confirm order" },
      { status: 500 },
    );
  }
}
