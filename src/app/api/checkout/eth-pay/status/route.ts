import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  http,
  parseAbiItem,
  formatEther,
  formatUnits,
} from "viem";
import type { Chain } from "viem";
import {
  mainnet,
  arbitrum,
  base,
  polygon,
  bsc,
  optimism,
  sepolia,
  baseSepolia,
} from "viem/chains";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import {
  getRpcUrl,
  getTokenAddress,
  TOKEN_DECIMALS,
  USDC_ADDRESSES,
  USDT_ADDRESSES,
} from "~/lib/contracts/evm-payment";

// Chain configurations for viem (typed as Chain to allow different block explorer names)
const CHAINS: Record<number, Chain> = {
  1: mainnet,
  42161: arbitrum,
  8453: base,
  137: polygon,
  56: bsc,
  10: optimism,
  11155111: sepolia,
  84532: baseSepolia,
};

/**
 * Get the balance of an address (ETH or ERC20 token)
 */
async function getBalance(
  chainId: number,
  address: `0x${string}`,
  token: "ETH" | "USDC" | "USDT",
): Promise<bigint> {
  const chain = CHAINS[chainId];
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`);

  const client = createPublicClient({
    chain,
    transport: http(getRpcUrl(chainId)),
  });

  if (token === "ETH") {
    return client.getBalance({ address });
  }

  // ERC20 token
  const tokenAddress = getTokenAddress(chainId, token);
  if (!tokenAddress)
    throw new Error(`Token ${token} not supported on chain ${chainId}`);

  const balance = await client.readContract({
    address: tokenAddress,
    abi: [parseAbiItem("function balanceOf(address) view returns (uint256)")],
    functionName: "balanceOf",
    args: [address],
  });

  return balance as bigint;
}

/**
 * Check if the payment amount is sufficient
 */
function isPaymentSufficient(
  balance: bigint,
  expectedAmount: bigint,
  token: "ETH" | "USDC" | "USDT",
): boolean {
  // Allow 0.1% tolerance for rounding/gas
  const tolerance = expectedAmount / 1000n;
  return balance >= expectedAmount - tolerance;
}

/**
 * GET /api/checkout/eth-pay/status
 * Check the payment status for an order
 *
 * Query params:
 * - orderId: The order ID to check
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
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

    // If already paid or confirmed, return current status
    if (order.paymentStatus === "paid" || order.paymentStatus === "confirmed") {
      return NextResponse.json({
        orderId,
        status: "confirmed",
        paymentStatus: order.paymentStatus,
        txHash: order.cryptoTxHash,
        paidAt: order.updatedAt,
      });
    }

    // If cancelled or expired
    if (order.status === "cancelled" || order.status === "expired") {
      return NextResponse.json({
        orderId,
        status: order.status,
        paymentStatus: order.paymentStatus,
      });
    }

    // Check if order has expired (1 hour)
    const createdAt = new Date(order.createdAt);
    const expiresAt = new Date(createdAt.getTime() + 60 * 60 * 1000);
    if (new Date() > expiresAt) {
      // Mark as expired
      await db
        .update(ordersTable)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(ordersTable.id, orderId));

      return NextResponse.json({
        orderId,
        status: "expired",
        paymentStatus: "pending",
        message: "Payment window expired. Please create a new order.",
      });
    }

    // Get payment details
    const depositAddress = order.solanaPayDepositAddress as `0x${string}`;
    const chainId = order.chainId ?? 1;
    const token = (order.cryptoCurrency ?? "ETH") as "ETH" | "USDC" | "USDT";

    if (!depositAddress) {
      return NextResponse.json(
        { error: "No deposit address found for order" },
        { status: 500 },
      );
    }

    // Check balance at deposit address
    let balance: bigint;
    try {
      balance = await getBalance(chainId, depositAddress, token);
    } catch (err) {
      console.error("Error fetching balance:", err);
      return NextResponse.json({
        orderId,
        status: "pending",
        paymentStatus: "pending",
        depositAddress,
        chainId,
        token,
        error: "Could not verify balance. Please try again.",
      });
    }

    // Calculate expected amount
    let expectedAmount: bigint;
    if (token === "ETH") {
      // ETH amount should be stored or calculated
      // For now, we'll need to check if cryptoAmount is set
      if (order.cryptoAmount) {
        expectedAmount = BigInt(order.cryptoAmount);
      } else {
        // Return pending with balance info - frontend needs to provide expected amount
        return NextResponse.json({
          orderId,
          status: "pending",
          paymentStatus: "pending",
          depositAddress,
          chainId,
          token,
          balance: balance.toString(),
          balanceFormatted: formatEther(balance),
          totalCents: order.totalCents,
          message: "Awaiting payment",
        });
      }
    } else {
      // USDC/USDT
      if (order.cryptoAmount) {
        expectedAmount = BigInt(order.cryptoAmount);
      } else {
        // Calculate from totalCents (1 USD = 1 USDC/USDT, 6 decimals)
        expectedAmount = BigInt(order.totalCents) * BigInt(10000); // cents to 6 decimals
      }
    }

    // Check if payment is sufficient
    const decimals = TOKEN_DECIMALS[token];
    const balanceFormatted =
      token === "ETH" ? formatEther(balance) : formatUnits(balance, decimals);
    const expectedFormatted =
      token === "ETH"
        ? formatEther(expectedAmount)
        : formatUnits(expectedAmount, decimals);

    if (balance > 0n && isPaymentSufficient(balance, expectedAmount, token)) {
      // Payment detected — but the status endpoint is READ-ONLY.
      // The client must call POST /api/checkout/eth-pay/confirm to finalize.
      return NextResponse.json({
        orderId,
        status: "ready_to_confirm",
        paymentStatus: "pending",
        depositAddress,
        chainId,
        token,
        balance: balance.toString(),
        balanceFormatted,
        expectedAmount: expectedAmount.toString(),
        expectedFormatted,
        message:
          "Payment detected! Please call the confirm endpoint to finalize.",
      });
    }

    // Payment not yet received or insufficient
    return NextResponse.json({
      orderId,
      status: "pending",
      paymentStatus: "pending",
      depositAddress,
      chainId,
      token,
      balance: balance.toString(),
      balanceFormatted,
      expectedAmount: expectedAmount.toString(),
      expectedFormatted,
      expiresAt: expiresAt.toISOString(),
      message:
        balance > 0n
          ? `Partial payment received: ${balanceFormatted} ${token}. Expected: ${expectedFormatted} ${token}`
          : "Awaiting payment",
    });
  } catch (err) {
    console.error("ETH Pay status error:", err);
    return NextResponse.json(
      { error: "Failed to check payment status" },
      { status: 500 },
    );
  }
}
