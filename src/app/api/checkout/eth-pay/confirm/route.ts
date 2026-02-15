import type { Chain } from "viem";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  decodeEventLog,
  formatEther,
  formatUnits,
  http,
  isAddress,
  parseAbiItem,
} from "viem";
import {
  arbitrum,
  base,
  baseSepolia,
  bsc,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from "viem/chains";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { ERC20ABI } from "~/lib/contracts/abis";
import {
  getRpcUrl,
  getTokenAddress,
  TOKEN_DECIMALS,
} from "~/lib/contracts/evm-payment";
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

// Chain configurations for viem (typed as Chain to allow different block explorer names)
const CHAINS: Record<number, Chain> = {
  1: mainnet,
  10: optimism,
  56: bsc,
  137: polygon,
  8453: base,
  42161: arbitrum,
  84532: baseSepolia,
  11155111: sepolia,
};

interface ConfirmPaymentBody {
  orderId: string;
  payerAddress?: string;
  txHash: string;
}

/**
 * POST /api/checkout/eth-pay/confirm
 * Confirm a payment by verifying the transaction on-chain
 *
 * This endpoint:
 * 1. Fetches the transaction receipt
 * 2. Verifies the recipient matches the order's deposit address
 * 3. Verifies the amount is sufficient
 * 4. Updates the order status to paid/confirmed
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(
      `eth-pay-confirm:${ip}`,
      RATE_LIMITS.checkout,
    );
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const body = (await request.json()) as ConfirmPaymentBody;
    const { orderId, payerAddress, txHash } = body;

    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }
    if (!txHash || !txHash.startsWith("0x")) {
      return NextResponse.json(
        { error: "Valid txHash required" },
        { status: 400 },
      );
    }

    // Fetch order from database
    const orders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (orders.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orders[0];

    // Check if it's an EVM payment order
    if (order.paymentMethod !== "eth_pay") {
      return NextResponse.json(
        { error: "Not an EVM payment order" },
        { status: 400 },
      );
    }

    // If already confirmed, return success
    if (order.paymentStatus === "paid" || order.paymentStatus === "confirmed") {
      return NextResponse.json({
        message: "Payment already confirmed",
        orderId,
        status: "confirmed",
        txHash: order.cryptoTxHash || txHash,
      });
    }

    // Get order details
    const depositAddress =
      order.solanaPayDepositAddress?.toLowerCase() as `0x${string}`;
    const chainId = order.chainId ?? 1;
    const token = (order.cryptoCurrency ?? "ETH") as "ETH" | "USDC" | "USDT";

    if (!depositAddress) {
      return NextResponse.json(
        { error: "No deposit address found for order" },
        { status: 500 },
      );
    }

    // Get chain and create client
    const chain = CHAINS[chainId];
    if (!chain) {
      return NextResponse.json(
        { error: `Unsupported chain: ${chainId}` },
        { status: 400 },
      );
    }

    const client = createPublicClient({
      chain,
      transport: http(getRpcUrl(chainId)),
    });

    // Fetch transaction receipt
    let receipt;
    try {
      receipt = await client.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            "Transaction not found or not yet confirmed. Please wait for confirmation.",
        },
        { status: 400 },
      );
    }

    // Check transaction status
    if (receipt.status !== "success") {
      return NextResponse.json(
        { error: "Transaction failed on-chain" },
        { status: 400 },
      );
    }

    // Verify the transaction
    let verified = false;
    let amountReceived = 0n;
    let senderAddress = "";

    if (token === "ETH") {
      // For ETH transfers, fetch the transaction to verify recipient and value
      const tx = await client.getTransaction({ hash: txHash as `0x${string}` });

      // Check recipient
      if (tx.to?.toLowerCase() !== depositAddress) {
        return NextResponse.json(
          { error: "Transaction recipient does not match deposit address" },
          { status: 400 },
        );
      }

      amountReceived = tx.value;
      senderAddress = tx.from;
      verified = true;
    } else {
      // For ERC20 tokens, check Transfer event logs
      const tokenAddress = getTokenAddress(chainId, token);
      if (!tokenAddress) {
        return NextResponse.json(
          { error: `Token ${token} not supported on chain ${chainId}` },
          { status: 400 },
        );
      }

      // Find Transfer event to our deposit address
      const transferEvent = parseAbiItem(
        "event Transfer(address indexed from, address indexed to, uint256 value)",
      );

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== tokenAddress.toLowerCase()) continue;

        try {
          const decoded = decodeEventLog({
            abi: [transferEvent],
            data: log.data,
            topics: log.topics,
          });

          if (decoded.eventName === "Transfer") {
            const { from, to, value } = decoded.args as {
              from: string;
              to: string;
              value: bigint;
            };

            if (to.toLowerCase() === depositAddress) {
              amountReceived = value;
              senderAddress = from;
              verified = true;
              break;
            }
          }
        } catch {}
      }

      if (!verified) {
        return NextResponse.json(
          { error: "No valid token transfer found to deposit address" },
          { status: 400 },
        );
      }
    }

    // Verify amount is sufficient
    let expectedAmount: bigint;
    if (order.cryptoAmount) {
      expectedAmount = BigInt(order.cryptoAmount);
    } else if (token !== "ETH") {
      // Calculate from totalCents for stablecoins
      expectedAmount = BigInt(order.totalCents) * BigInt(10000);
    } else {
      // ETH orders MUST have cryptoAmount stored at creation time
      return NextResponse.json(
        {
          error:
            "Order missing expected payment amount. Please create a new order.",
        },
        { status: 400 },
      );
    }

    // Allow 0.5% tolerance for rounding
    const tolerance = expectedAmount / 200n;
    if (expectedAmount > 0n && amountReceived < expectedAmount - tolerance) {
      const decimals = TOKEN_DECIMALS[token];
      const receivedFormatted =
        token === "ETH"
          ? formatEther(amountReceived)
          : formatUnits(amountReceived, decimals);
      const expectedFormatted =
        token === "ETH"
          ? formatEther(expectedAmount)
          : formatUnits(expectedAmount, decimals);

      return NextResponse.json(
        {
          error: "Insufficient payment amount",
          expected: expectedFormatted,
          received: receivedFormatted,
          token,
        },
        { status: 400 },
      );
    }

    // Payment verified! Idempotent update: only transition from 'pending' to prevent double-fulfillment
    const updated = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ id: ordersTable.id, status: ordersTable.status })
        .from(ordersTable)
        .where(
          and(eq(ordersTable.id, orderId), eq(ordersTable.status, "pending")),
        )
        .limit(1);
      if (!current) return null; // already processed by a concurrent request
      await tx
        .update(ordersTable)
        .set({
          cryptoTxHash: txHash,
          payerWalletAddress: payerAddress || senderAddress,
          paymentStatus: "paid",
          status: "processing",
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, orderId));
      return current;
    });

    if (!updated) {
      return NextResponse.json({
        message: "Payment already confirmed",
        orderId,
        status: "confirmed",
        txHash: order.cryptoTxHash || txHash,
      });
    }

    void onOrderCreated(orderId);

    // Send to Printful if order contains Printful items
    let printfulOrderId: number | undefined;
    let printfulError: string | undefined;

    try {
      const hasPrintful = await hasPrintfulItems(orderId);
      if (hasPrintful) {
        console.log(
          `Order ${orderId} has Printful items, creating Printful order...`,
        );
        const printfulResult = await createAndConfirmPrintfulOrder(orderId);
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
      const hasPrintify = await hasPrintifyItems(orderId);
      if (hasPrintify) {
        console.log(
          `Order ${orderId} has Printify items, creating Printify order...`,
        );
        const printifyResult = await createAndConfirmPrintifyOrder(orderId);
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
      const hasEsim = await hasEsimItems(orderId);
      if (hasEsim) {
        const esimResult = await fulfillEsimOrder(orderId);
        if (!esimResult.success) esimError = esimResult.error;
      }
    } catch (eError) {
      esimError = eError instanceof Error ? eError.message : "Unknown error";
    }

    const decimals = TOKEN_DECIMALS[token];
    const amountFormatted =
      token === "ETH"
        ? formatEther(amountReceived)
        : formatUnits(amountReceived, decimals);

    return NextResponse.json({
      amount: amountReceived.toString(),
      amountFormatted,
      chainId,
      message: "Payment confirmed successfully!",
      orderId,
      payer: senderAddress,
      paymentStatus: "paid",
      status: "confirmed",
      token,
      txHash,
      ...((printfulError || printifyError || esimError) && {
        fulfillmentError: [printfulError, printifyError, esimError]
          .filter(Boolean)
          .join("; "),
      }),
    });
  } catch (err) {
    console.error("ETH Pay confirm error:", err);
    return NextResponse.json(
      { error: "Failed to confirm payment" },
      { status: 500 },
    );
  }
}
