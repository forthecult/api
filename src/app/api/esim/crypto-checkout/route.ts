import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { esimOrdersTable, ordersTable } from "~/db/schema";
import { getCurrentUser } from "~/lib/auth";
import {
  buildSuccessRedirectUrl,
  buildWebhookUrl,
  createBtcpayInvoice,
  getBtcpayConfig,
} from "~/lib/btcpay";
import { getCoinGeckoSimplePrice } from "~/lib/coingecko";
import {
  FACTORY_ADDRESSES,
  getPaymentReceiverAddress,
  getTokenAddress,
  isFactoryDeployed,
  orderIdToBytes32,
  usdCentsToTokenAmount,
} from "~/lib/contracts/evm-payment";
import { deriveDepositAddress } from "~/lib/solana-deposit";
import {
  getTonWalletAddress,
  isTonPayConfigured,
  usdCentsToTonAmount,
} from "~/lib/ton-pay";

const CHAIN_IDS: Record<string, number> = {
  arbitrum: 42161,
  base: 8453,
  bnb: 56,
  ethereum: 1,
  optimism: 10,
  polygon: 137,
};

const TON_USD_FALLBACK = 7;

interface CryptoCheckoutBody {
  chain?: string;
  orderId: string;
  paymentMethod: "btcpay" | "eth_pay" | "solana_pay" | "ton_pay";
  /** For solana_pay: "solana" | "usdc" | "crust" | "pump" | "troll". For eth_pay: "ETH" | "USDC" | "USDT". */
  token?: string;
}

/**
 * POST /api/esim/crypto-checkout
 *
 * Sets up crypto payment details on an existing eSIM order (created by /api/esim/purchase).
 * Updates the order with deposit address / invoice and returns success so the frontend
 * can redirect to /checkout/{orderId}#solana|eth|bitcoin|ton.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const body = (await request.json()) as CryptoCheckoutBody;
    const { chain = "ethereum", orderId, paymentMethod, token = "ETH" } = body;

    if (!orderId || !paymentMethod) {
      return NextResponse.json(
        { message: "orderId and paymentMethod are required", status: false },
        { status: 400 },
      );
    }

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) {
      return NextResponse.json(
        { message: "Order not found", status: false },
        { status: 404 },
      );
    }

    if (order.paymentStatus === "paid") {
      return NextResponse.json(
        { message: "Order is already paid", status: false },
        { status: 400 },
      );
    }

    if (order.userId != null && user?.id !== order.userId) {
      return NextResponse.json(
        { message: "Order not found", status: false },
        { status: 404 },
      );
    }

    const [esimOrder] = await db
      .select()
      .from(esimOrdersTable)
      .where(eq(esimOrdersTable.orderId, orderId))
      .limit(1);

    if (!esimOrder) {
      return NextResponse.json(
        { message: "eSIM order not found", status: false },
        { status: 404 },
      );
    }

    const totalCents = order.totalCents;

    if (paymentMethod === "solana_pay") {
      if (!process.env.SOLANA_DEPOSIT_SECRET?.trim()) {
        return NextResponse.json(
          { message: "Solana Pay is not configured", status: false },
          { status: 503 },
        );
      }
      const depositAddress = deriveDepositAddress(orderId);
      // Map token name to cryptoCurrency for the checkout page (USDC, CRUST, CULT, PUMP, TROLL, SOLUNA, SKR, SOL)
      const solToken = (token ?? "solana").toLowerCase();
      const cryptoCurrency =
        solToken === "usdc"
          ? "USDC"
          : solToken === "crust"
            ? "CRUST"
            : solToken === "cult"
              ? "CULT"
              : solToken === "pump"
                ? "PUMP"
                : solToken === "troll"
                  ? "TROLL"
                  : solToken === "soluna"
                    ? "SOLUNA"
                    : solToken === "seeker"
                      ? "SKR"
                      : "SOL";
      await db
        .update(ordersTable)
        .set({
          cryptoCurrency,
          cryptoCurrencyNetwork: "solana",
          paymentMethod: "solana_pay",
          solanaPayDepositAddress: depositAddress,
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, orderId));
      await db
        .update(esimOrdersTable)
        .set({ paymentMethod: "solana_pay", updatedAt: new Date() })
        .where(eq(esimOrdersTable.orderId, orderId));
      return NextResponse.json({ depositAddress, status: true });
    }

    if (paymentMethod === "eth_pay") {
      const chainId = CHAIN_IDS[chain.toLowerCase()] ?? 1;
      if (!isFactoryDeployed(chainId)) {
        return NextResponse.json(
          { message: `Payment not supported on ${chain}`, status: false },
          { status: 400 },
        );
      }
      const depositAddress = getPaymentReceiverAddress(chainId, orderId);
      if (!depositAddress) {
        return NextResponse.json(
          { message: "Could not generate payment address", status: false },
          { status: 500 },
        );
      }
      const tokenUpper = token.toUpperCase() as "ETH" | "USDC" | "USDT";
      let cryptoAmount: null | string = null;
      if (tokenUpper !== "ETH") {
        const amountWei = usdCentsToTokenAmount(totalCents, tokenUpper);
        cryptoAmount = amountWei.toString();
      }
      await db
        .update(ordersTable)
        .set({
          chainId,
          cryptoAmount,
          cryptoCurrency: tokenUpper,
          cryptoCurrencyNetwork: chain.toLowerCase(),
          paymentMethod: "eth_pay",
          solanaPayDepositAddress: depositAddress,
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, orderId));
      await db
        .update(esimOrdersTable)
        .set({ paymentMethod: "eth_pay", updatedAt: new Date() })
        .where(eq(esimOrdersTable.orderId, orderId));
      return NextResponse.json({
        chainId,
        cryptoAmount,
        depositAddress,
        factoryAddress: FACTORY_ADDRESSES[chainId],
        orderIdBytes32: orderIdToBytes32(orderId),
        status: true,
        tokenAddress:
          tokenUpper === "USDC" || tokenUpper === "USDT"
            ? getTokenAddress(chainId, tokenUpper)
            : undefined,
      });
    }

    if (paymentMethod === "btcpay") {
      const { configured } = getBtcpayConfig();
      if (!configured) {
        return NextResponse.json(
          { message: "Bitcoin payment is not configured", status: false },
          { status: 503 },
        );
      }
      const origin =
        process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://forthecult.store";
      const invoice = await createBtcpayInvoice({
        currency: "USD",
        itemDesc: `eSIM: ${esimOrder.packageName}`,
        notificationURL: buildWebhookUrl(origin),
        orderId,
        price: totalCents / 100,
        redirectURL: buildSuccessRedirectUrl(origin, orderId),
      });
      if (!invoice) {
        return NextResponse.json(
          { message: "Failed to create payment invoice", status: false },
          { status: 502 },
        );
      }
      await db
        .update(ordersTable)
        .set({
          btcpayInvoiceId: invoice.id,
          btcpayInvoiceUrl: invoice.url,
          cryptoCurrency: "BTC",
          paymentMethod: "btcpay",
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, orderId));
      await db
        .update(esimOrdersTable)
        .set({ paymentMethod: "btcpay", updatedAt: new Date() })
        .where(eq(esimOrdersTable.orderId, orderId));
      return NextResponse.json({
        invoiceId: invoice.id,
        invoiceUrl: invoice.url,
        status: true,
      });
    }

    if (paymentMethod === "ton_pay") {
      if (!isTonPayConfigured()) {
        return NextResponse.json(
          { message: "TON payments are not configured", status: false },
          { status: 503 },
        );
      }
      const depositAddress = getTonWalletAddress();
      if (!depositAddress) {
        return NextResponse.json(
          { message: "TON wallet not configured", status: false },
          { status: 503 },
        );
      }
      let tonUsdRate = TON_USD_FALLBACK;
      try {
        const data = await getCoinGeckoSimplePrice(["toncoin"]);
        const rate = data?.toncoin?.usd;
        if (typeof rate === "number" && rate > 0) tonUsdRate = rate;
      } catch {
        // use fallback
      }
      const tonAmount = usdCentsToTonAmount(totalCents, tonUsdRate);
      await db
        .update(ordersTable)
        .set({
          cryptoAmount: tonAmount,
          cryptoCurrency: "TON",
          cryptoCurrencyNetwork: "ton",
          paymentMethod: "ton_pay",
          solanaPayDepositAddress: depositAddress,
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, orderId));
      await db
        .update(esimOrdersTable)
        .set({ paymentMethod: "ton_pay", updatedAt: new Date() })
        .where(eq(esimOrdersTable.orderId, orderId));
      return NextResponse.json({
        depositAddress,
        status: true,
        tonAmount,
      });
    }

    return NextResponse.json(
      { message: "Unsupported payment method", status: false },
      { status: 400 },
    );
  } catch (err) {
    console.error("eSIM crypto-checkout error:", err);
    return NextResponse.json(
      { message: "Failed to set up crypto payment", status: false },
      { status: 500 },
    );
  }
}
