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
        id: ordersTable.id,
        createdAt: ordersTable.createdAt,
        email: ordersTable.email,
        status: ordersTable.status,
        totalCents: ordersTable.totalCents,
        solanaPayDepositAddress: ordersTable.solanaPayDepositAddress,
        paymentMethod: ordersTable.paymentMethod,
        cryptoCurrencyNetwork: ordersTable.cryptoCurrencyNetwork,
        cryptoCurrency: ordersTable.cryptoCurrency,
        cryptoAmount: ordersTable.cryptoAmount,
        chainId: ordersTable.chainId,
        btcpayInvoiceId: ordersTable.btcpayInvoiceId,
        btcpayInvoiceUrl: ordersTable.btcpayInvoiceUrl,
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

    // Determine payment type from stored data
    const isEthPayment =
      order.paymentMethod === "eth_pay" ||
      order.cryptoCurrencyNetwork?.toLowerCase() === "ethereum" ||
      ["eth", "usdc", "usdt"].includes(
        order.cryptoCurrency?.toLowerCase() ?? "",
      );

    return NextResponse.json({
      orderId: order.id,
      depositAddress: order.solanaPayDepositAddress ?? undefined,
      totalCents: order.totalCents,
      email: order.email ?? undefined,
      expiresAt,
      // ETH-specific fields
      ...(isEthPayment && {
        paymentType: "eth",
        chain: order.cryptoCurrencyNetwork?.toLowerCase() ?? "ethereum",
        token: order.cryptoCurrency?.toLowerCase() ?? "eth",
        chainId: order.chainId ?? 1,
      }),
      // BTCPay (Bitcoin, Dogecoin, Monero)
      ...(isBtcpay && {
        paymentType: "btcpay",
        token: (order.cryptoCurrency?.toLowerCase() ?? "bitcoin") as
          | "bitcoin"
          | "doge"
          | "monero",
        btcpayInvoiceId: order.btcpayInvoiceId ?? undefined,
        btcpayInvoiceUrl: order.btcpayInvoiceUrl ?? undefined,
      }),
      // TON (Toncoin)
      ...(isTonPay && {
        paymentType: "ton",
        depositAddress: order.solanaPayDepositAddress ?? undefined,
        tonAmount: order.cryptoAmount ?? undefined,
        comment: order.id,
      }),
      _actions: {
        next: `Poll GET /api/orders/${order.id}/status every 5s until status changes`,
        cancel: `POST /api/orders/${order.id}/cancel (only before payment)`,
        help: "Contact support@culturestore.com",
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
