import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getCurrentUser } from "~/lib/auth";
import { db } from "~/db";
import { esimOrdersTable, ordersTable } from "~/db/schema";
import { deriveDepositAddress } from "~/lib/solana-deposit";
import {
  buildSuccessRedirectUrl,
  buildWebhookUrl,
  createBtcpayInvoice,
  getBtcpayConfig,
} from "~/lib/btcpay";
import {
  getPaymentReceiverAddress,
  isFactoryDeployed,
  orderIdToBytes32,
  usdCentsToTokenAmount,
  getTokenAddress,
  FACTORY_ADDRESSES,
} from "~/lib/contracts/evm-payment";
import { getCoinGeckoSimplePrice } from "~/lib/coingecko";
import {
  getTonWalletAddress,
  isTonPayConfigured,
  usdCentsToTonAmount,
} from "~/lib/ton-pay";

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
  polygon: 137,
  bnb: 56,
  optimism: 10,
};

const TON_USD_FALLBACK = 7;

type CryptoCheckoutBody = {
  orderId: string;
  paymentMethod: "solana_pay" | "eth_pay" | "btcpay" | "ton_pay";
  chain?: string;
  /** For solana_pay: "solana" | "usdc" | "crust" | "pump" | "troll". For eth_pay: "ETH" | "USDC" | "USDT". */
  token?: string;
};

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
    const { orderId, paymentMethod, chain = "ethereum", token = "ETH" } = body;

    if (!orderId || !paymentMethod) {
      return NextResponse.json(
        { status: false, message: "orderId and paymentMethod are required" },
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
        { status: false, message: "Order not found" },
        { status: 404 },
      );
    }

    if (order.paymentStatus === "paid") {
      return NextResponse.json(
        { status: false, message: "Order is already paid" },
        { status: 400 },
      );
    }

    if (order.userId != null && user?.id !== order.userId) {
      return NextResponse.json(
        { status: false, message: "Order not found" },
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
        { status: false, message: "eSIM order not found" },
        { status: 404 },
      );
    }

    const totalCents = order.totalCents;

    if (paymentMethod === "solana_pay") {
      if (!process.env.SOLANA_DEPOSIT_SECRET?.trim()) {
        return NextResponse.json(
          { status: false, message: "Solana Pay is not configured" },
          { status: 503 },
        );
      }
      const depositAddress = deriveDepositAddress(orderId);
      // Map token name to cryptoCurrency for the checkout page (USDC, CRUST, PUMP, TROLL, SOL)
      const solToken = (token ?? "solana").toLowerCase();
      const cryptoCurrency =
        solToken === "usdc"
          ? "USDC"
          : solToken === "crust"
            ? "CRUST"
            : solToken === "pump"
              ? "PUMP"
              : solToken === "troll"
                ? "TROLL"
                : "SOL";
      await db
        .update(ordersTable)
        .set({
          paymentMethod: "solana_pay",
          solanaPayDepositAddress: depositAddress,
          cryptoCurrency,
          cryptoCurrencyNetwork: "solana",
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, orderId));
      await db
        .update(esimOrdersTable)
        .set({ paymentMethod: "solana_pay", updatedAt: new Date() })
        .where(eq(esimOrdersTable.orderId, orderId));
      return NextResponse.json({ status: true, depositAddress });
    }

    if (paymentMethod === "eth_pay") {
      const chainId = CHAIN_IDS[chain.toLowerCase()] ?? 1;
      if (!isFactoryDeployed(chainId)) {
        return NextResponse.json(
          { status: false, message: `Payment not supported on ${chain}` },
          { status: 400 },
        );
      }
      const depositAddress = getPaymentReceiverAddress(chainId, orderId);
      if (!depositAddress) {
        return NextResponse.json(
          { status: false, message: "Could not generate payment address" },
          { status: 500 },
        );
      }
      const tokenUpper = token.toUpperCase() as "ETH" | "USDC" | "USDT";
      let cryptoAmount: string | null = null;
      if (tokenUpper !== "ETH") {
        const amountWei = usdCentsToTokenAmount(totalCents, tokenUpper);
        cryptoAmount = amountWei.toString();
      }
      await db
        .update(ordersTable)
        .set({
          paymentMethod: "eth_pay",
          solanaPayDepositAddress: depositAddress,
          chainId,
          cryptoCurrencyNetwork: chain.toLowerCase(),
          cryptoCurrency: tokenUpper,
          cryptoAmount,
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, orderId));
      await db
        .update(esimOrdersTable)
        .set({ paymentMethod: "eth_pay", updatedAt: new Date() })
        .where(eq(esimOrdersTable.orderId, orderId));
      return NextResponse.json({
        status: true,
        depositAddress,
        chainId,
        cryptoAmount,
        tokenAddress:
          tokenUpper === "USDC" || tokenUpper === "USDT"
            ? getTokenAddress(chainId, tokenUpper)
            : undefined,
        factoryAddress: FACTORY_ADDRESSES[chainId],
        orderIdBytes32: orderIdToBytes32(orderId),
      });
    }

    if (paymentMethod === "btcpay") {
      const { configured } = getBtcpayConfig();
      if (!configured) {
        return NextResponse.json(
          { status: false, message: "Bitcoin payment is not configured" },
          { status: 503 },
        );
      }
      const origin =
        process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://forthecult.store";
      const invoice = await createBtcpayInvoice({
        price: totalCents / 100,
        currency: "USD",
        orderId,
        itemDesc: `eSIM: ${esimOrder.packageName}`,
        notificationURL: buildWebhookUrl(origin),
        redirectURL: buildSuccessRedirectUrl(origin, orderId),
      });
      if (!invoice) {
        return NextResponse.json(
          { status: false, message: "Failed to create payment invoice" },
          { status: 502 },
        );
      }
      await db
        .update(ordersTable)
        .set({
          paymentMethod: "btcpay",
          btcpayInvoiceId: invoice.id,
          btcpayInvoiceUrl: invoice.url,
          cryptoCurrency: "BTC",
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, orderId));
      await db
        .update(esimOrdersTable)
        .set({ paymentMethod: "btcpay", updatedAt: new Date() })
        .where(eq(esimOrdersTable.orderId, orderId));
      return NextResponse.json({
        status: true,
        invoiceId: invoice.id,
        invoiceUrl: invoice.url,
      });
    }

    if (paymentMethod === "ton_pay") {
      if (!isTonPayConfigured()) {
        return NextResponse.json(
          { status: false, message: "TON payments are not configured" },
          { status: 503 },
        );
      }
      const depositAddress = getTonWalletAddress();
      if (!depositAddress) {
        return NextResponse.json(
          { status: false, message: "TON wallet not configured" },
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
          paymentMethod: "ton_pay",
          solanaPayDepositAddress: depositAddress,
          cryptoCurrency: "TON",
          cryptoAmount: tonAmount,
          cryptoCurrencyNetwork: "ton",
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, orderId));
      await db
        .update(esimOrdersTable)
        .set({ paymentMethod: "ton_pay", updatedAt: new Date() })
        .where(eq(esimOrdersTable.orderId, orderId));
      return NextResponse.json({
        status: true,
        depositAddress,
        tonAmount,
      });
    }

    return NextResponse.json(
      { status: false, message: "Unsupported payment method" },
      { status: 400 },
    );
  } catch (err) {
    console.error("eSIM crypto-checkout error:", err);
    return NextResponse.json(
      { status: false, message: "Failed to set up crypto payment" },
      { status: 500 },
    );
  }
}
