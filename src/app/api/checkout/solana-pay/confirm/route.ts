import { validateTransfer, type Amount } from "@solana/pay";
import {
  Connection,
  PublicKey,
  SystemInstruction,
  SystemProgram,
  TransactionMessage,
} from "@solana/web3.js";
import BigNumber from "bignumber.js";
import { and, eq, or } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { onOrderCreated } from "~/lib/create-user-notification";
import { fulfillSubscriptionCryptoOrder } from "~/lib/subscription-crypto-fulfillment";
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
import {
  CRUST_MINT_MAINNET,
  CULT_MINT_MAINNET,
  getSolanaRpcUrlServer,
  PUMP_MINT_MAINNET,
  SKR_MINT_MAINNET,
  TROLL_MINT_MAINNET,
  USDC_MINT_MAINNET,
  WHITEWHALE_MINT_MAINNET,
} from "~/lib/solana-pay";
import { getTokenBalanceAnyProgram } from "~/lib/solana-token-utils";

const NATIVE_SOL_SENTINEL = "native";

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
      amount?: string;
      depositAddress?: string;
      orderId?: string;
      /** Payer wallet address (from connected wallet) so we can link order to user when they sign up later */
      payerWalletAddress?: string;
      reference?: string;
      signature?: string;
      splToken?: string;
    };
    const {
      amount,
      depositAddress,
      orderId,
      payerWalletAddress: payerWalletFromBody,
      reference,
      signature,
      splToken,
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
        cryptoAmount: ordersTable.cryptoAmount,
        hasAmazonItems: ordersTable.hasAmazonItems,
        id: ordersTable.id,
        paymentMethod: ordersTable.paymentMethod,
        solanaPayDepositAddress: ordersTable.solanaPayDepositAddress,
        status: ordersTable.status,
        totalCents: ordersTable.totalCents,
      })
      .from(ordersTable)
      .where(or(...conditions))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.paymentMethod !== "solana_pay") {
      return NextResponse.json(
        { error: "Not a Solana Pay order" },
        { status: 400 },
      );
    }
    if (order.status !== "pending") {
      return NextResponse.json({ alreadyPaid: true, orderId: order.id });
    }

    const depositAddressStr = order.solanaPayDepositAddress ?? depositAddress;
    if (!depositAddressStr?.trim()) {
      return NextResponse.json(
        { error: "Order has no deposit address" },
        { status: 400 },
      );
    }

    // Signature for on-chain verification.
    // "balance-verified" is a sentinel from the status route indicating balance was
    // verified without a specific transaction signature (e.g. Token-2022 fallback).
    const sigTrim = typeof signature === "string" ? signature.trim() : "";
    const isBalanceVerified = sigTrim === "balance-verified";
    if (!sigTrim) {
      return NextResponse.json(
        {
          error: "signature required (server verifies transfer on-chain)",
        },
        { status: 400 },
      );
    }

    // Use server-stored amount for SPL tokens / USDC. For native SOL, when order has no
    // cryptoAmount, the client sends amount in lamports — use that for verification so we
    // match the correct tx and store the actual SOL amount.
    const isNativeSol = splToken === NATIVE_SOL_SENTINEL;
    let serverAmount: string;
    if (order.cryptoAmount) {
      serverAmount = order.cryptoAmount;
    } else if (isNativeSol && amount != null && String(amount).trim() !== "") {
      // Client sends lamports for native SOL; we'll verify with this and store actual SOL from tx
      serverAmount = String(amount).trim();
    } else {
      // Default: USDC where 1 USD = 1 USDC, totalCents / 100
      serverAmount = (order.totalCents / 100).toString();
    }

    const splTokenMint =
      splToken === NATIVE_SOL_SENTINEL
        ? USDC_MINT_MAINNET
        : splToken === WHITEWHALE_MINT_MAINNET
          ? WHITEWHALE_MINT_MAINNET
          : splToken === CRUST_MINT_MAINNET
            ? CRUST_MINT_MAINNET
            : splToken === CULT_MINT_MAINNET
              ? CULT_MINT_MAINNET
              : splToken === PUMP_MINT_MAINNET
                ? PUMP_MINT_MAINNET
                : splToken === TROLL_MINT_MAINNET
                  ? TROLL_MINT_MAINNET
                  : splToken === SKR_MINT_MAINNET
                    ? SKR_MINT_MAINNET
                    : USDC_MINT_MAINNET;

    let verifiedNativeSolLamports: number | undefined;
    try {
      const connection = new Connection(getSolanaRpcUrlServer(), {
        commitment: "confirmed",
      });
      const depositPk = new PublicKey(depositAddressStr);
      const amountBn = new BigNumber(serverAmount);
      if (isNativeSol) {
        const expectedLamports = amountBn.integerValue().toNumber();
        const result = await verifyNativeSolTransfer(
          connection,
          sigTrim,
          depositPk,
          expectedLamports,
        );
        if (!result.ok) {
          return NextResponse.json(
            { error: "Transfer verification failed (native SOL)" },
            { status: 400 },
          );
        }
        verifiedNativeSolLamports = result.lamports;
      } else if (isBalanceVerified) {
        // Status route already verified balance — just re-confirm here
        const balance = await getTokenBalanceAnyProgram(
          connection,
          splTokenMint,
          depositPk,
        );
        if (!balance) {
          return NextResponse.json(
            { error: "Transfer verification failed (no token balance)" },
            { status: 400 },
          );
        }
        const expectedBaseUnits = BigInt(
          amountBn
            .times(new BigNumber(10).pow(balance.decimals))
            .integerValue(BigNumber.ROUND_FLOOR)
            .toString(),
        );
        if (balance.amount < expectedBaseUnits) {
          return NextResponse.json(
            { error: "Transfer verification failed (insufficient balance)" },
            { status: 400 },
          );
        }
      } else {
        // Try @solana/pay validateTransfer first (standard Token Program),
        // then fall back to a balance check for Token-2022 tokens (pump.fun etc.)
        let transferVerified = false;
        try {
          await validateTransfer(connection, sigTrim, {
            amount: amountBn as unknown as Amount,
            recipient: depositPk,
            splToken: new PublicKey(splTokenMint),
          });
          transferVerified = true;
        } catch {
          // validateTransfer failed — try Token-2022 balance check fallback
          try {
            const balance = await getTokenBalanceAnyProgram(
              connection,
              splTokenMint,
              depositPk,
            );
            if (balance) {
              const expectedBaseUnits = BigInt(
                amountBn
                  .times(new BigNumber(10).pow(balance.decimals))
                  .integerValue(BigNumber.ROUND_FLOOR)
                  .toString(),
              );
              if (balance.amount >= expectedBaseUnits) {
                transferVerified = true;
              }
            }
          } catch {
            // balance check also failed
          }
        }
        if (!transferVerified) {
          return NextResponse.json(
            { error: "Transfer verification failed" },
            { status: 400 },
          );
        }
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

    // Derive display-friendly token name from SPL token mint
    const tokenDisplayName = isNativeSol
      ? "SOL"
      : splTokenMint === CRUST_MINT_MAINNET
        ? "CRUST"
        : splTokenMint === CULT_MINT_MAINNET
          ? "CULT"
          : splTokenMint === PUMP_MINT_MAINNET
            ? "PUMP"
            : splTokenMint === TROLL_MINT_MAINNET
              ? "TROLL"
              : splTokenMint === WHITEWHALE_MINT_MAINNET
                ? "WHITEWHALE"
                : splTokenMint === SKR_MINT_MAINNET
                  ? "SKR"
                  : "USDC";

    // For native SOL, store the actual SOL amount from the verified tx (not USD)
    const amountToStore =
      isNativeSol && verifiedNativeSolLamports != null
        ? (verifiedNativeSolLamports / 1e9).toFixed(9).replace(/\.?0+$/, "")
        : serverAmount;

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
          fulfillmentStatus: "unfulfilled",
          paymentStatus: "paid",
          status: "paid",
          updatedAt: new Date(),
          // Store crypto payment details for admin visibility
          // Don't store the "balance-verified" sentinel as a real txid
          ...(sigTrim && !isBalanceVerified ? { cryptoTxHash: sigTrim } : {}),
          cryptoAmount: amountToStore,
          cryptoCurrency: tokenDisplayName,
          cryptoCurrencyNetwork: "Solana",
          ...(typeof payerWalletFromBody === "string" &&
          payerWalletFromBody.trim()
            ? { payerWalletAddress: payerWalletFromBody.trim() }
            : {}),
        })
        .where(eq(ordersTable.id, order.id));
      return current;
    });

    if (!updated) {
      return NextResponse.json({ alreadyPaid: true, orderId: order.id });
    }

    void onOrderCreated(order.id);
    void fulfillSubscriptionCryptoOrder(order.id);

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
    console.error("Solana Pay confirm error:", err);
    return NextResponse.json(
      { error: "Failed to confirm order" },
      { status: 500 },
    );
  }
}

/** Verify that the given signature is a native SOL transfer to depositAddress with at least expectedLamports. Returns actual lamports transferred for correct admin display. */
async function verifyNativeSolTransfer(
  connection: Connection,
  signature: string,
  depositAddress: PublicKey,
  expectedLamports: number,
): Promise<{ ok: boolean; lamports?: number }> {
  const tx = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx?.transaction?.message) return { ok: false };
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
        return { ok: true, lamports: Number(decoded.lamports) };
      }
    } catch {
      // not a transfer instruction
    }
  }
  return { ok: false };
}
