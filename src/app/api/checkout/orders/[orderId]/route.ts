import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";

const PAYMENT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Public (no auth) payment info for crypto checkout. Used so the crypto page
 * can show deposit address, amount, and expiry without putting them in the URL.
 * Returns 404 if order not found, not pending, or missing deposit address.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    if (!orderId?.trim()) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const [order] = await db
      .select({
        btcpayInvoiceId: ordersTable.btcpayInvoiceId,
        btcpayInvoiceUrl: ordersTable.btcpayInvoiceUrl,
        chainId: ordersTable.chainId,
        createdAt: ordersTable.createdAt,
        cryptoAmount: ordersTable.cryptoAmount,
        cryptoCurrency: ordersTable.cryptoCurrency,
        cryptoCurrencyNetwork: ordersTable.cryptoCurrencyNetwork,
        email: ordersTable.email,
        id: ordersTable.id,
        paymentMethod: ordersTable.paymentMethod,
        solanaPayDepositAddress: ordersTable.solanaPayDepositAddress,
        status: ordersTable.status,
        totalCents: ordersTable.totalCents,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId.trim()))
      .limit(1);

    if (!order || order.status !== "pending") {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const isBtcpay = order.paymentMethod === "btcpay";
    const isTonPay = order.paymentMethod === "ton_pay";
    const hasDeposit = order.solanaPayDepositAddress?.trim();
    const hasBtcpayInvoice =
      isBtcpay &&
      (order.btcpayInvoiceId?.trim() ?? order.btcpayInvoiceUrl?.trim());
    const hasTonPay = isTonPay && hasDeposit;
    if (!hasDeposit && !hasBtcpayInvoice && !isBtcpay && !hasTonPay) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const expiresAt = new Date(
      order.createdAt.getTime() + PAYMENT_WINDOW_MS,
    ).toISOString();

    // Solana Pay: return token so payment page checks the correct balance (SOL vs USDC vs SPL)
    // Check Solana Pay FIRST since USDC/USDT can be on either Solana or EVM
    const isSolanaPay = order.paymentMethod === "solana_pay" && hasDeposit;

    // Determine payment type from stored data
    // Only consider it an ETH payment if it's NOT a Solana Pay order
    const isEthPayment =
      !isSolanaPay &&
      (order.paymentMethod === "eth_pay" ||
        order.cryptoCurrencyNetwork?.toLowerCase() === "ethereum" ||
        order.cryptoCurrencyNetwork?.toLowerCase() === "arbitrum" ||
        order.cryptoCurrencyNetwork?.toLowerCase() === "base" ||
        order.cryptoCurrencyNetwork?.toLowerCase() === "polygon" ||
        ["eth"].includes(order.cryptoCurrency?.toLowerCase() ?? ""));
    const SOLANA_CURRENCY_TO_TOKEN: Record<string, string> = {
      CRUST: "crust",
      PUMP: "pump",
      SOL: "solana",
      SOLUNA: "soluna",
      TROLL: "troll",
      USDC: "usdc",
      WHITEWHALE: "whitewhale",
    };
    const solanaPayToken =
      isSolanaPay && order.cryptoCurrency
        ? (SOLANA_CURRENCY_TO_TOKEN[order.cryptoCurrency.toUpperCase()] ??
          order.cryptoCurrency.toLowerCase())
        : undefined;

    return NextResponse.json({
      depositAddress: order.solanaPayDepositAddress ?? undefined,
      email: order.email
        ? order.email.replace(/^(.{2})(.*)(@.*)$/, "$1***$3")
        : undefined,
      expiresAt,
      orderId: order.id,
      totalCents: order.totalCents,
      // Solana Pay: routing and balance check (paymentType when URL has no hash)
      ...(isSolanaPay && { paymentType: "solana" as const }),
      ...(solanaPayToken && { token: solanaPayToken }),
      // ETH-specific fields
      ...(isEthPayment && {
        chain: order.cryptoCurrencyNetwork?.toLowerCase() ?? "ethereum",
        chainId: order.chainId ?? 1,
        paymentType: "eth",
        token: order.cryptoCurrency?.toLowerCase() ?? "eth",
      }),
      // BTCPay (Bitcoin, Dogecoin, Monero)
      ...(isBtcpay && {
        btcpayInvoiceId: order.btcpayInvoiceId ?? undefined,
        btcpayInvoiceUrl: order.btcpayInvoiceUrl ?? undefined,
        paymentType: "btcpay",
        token: (order.cryptoCurrency?.toLowerCase() ?? "bitcoin") as
          | "bitcoin"
          | "doge"
          | "monero",
      }),
      // TON (Toncoin)
      ...(isTonPay && {
        comment: order.id,
        depositAddress: order.solanaPayDepositAddress ?? undefined,
        paymentType: "ton",
        tonAmount: order.cryptoAmount ?? undefined,
      }),
      _actions: {
        cancel: `POST /api/orders/${order.id}/cancel (only before payment)`,
        help: "Contact support@forthecult.store",
        next: `Poll GET /api/orders/${order.id}/status every 5s until status changes`,
      },
    });
  } catch (err) {
    console.error("Checkout order payment info error:", err);
    return NextResponse.json(
      { error: "Failed to load order" },
      { status: 500 },
    );
  }
}
