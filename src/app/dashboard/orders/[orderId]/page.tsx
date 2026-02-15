import { eq } from "drizzle-orm";
import { CreditCard, ExternalLink, Smartphone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "~/db";
import { esimOrdersTable, ordersTable } from "~/db/schema";
import { getCurrentUserOrRedirect } from "~/lib/auth";
import { formatCents, formatDateLong } from "~/lib/format";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardHeader } from "~/ui/primitives/card";
import { Badge } from "~/ui/primitives/badge";

import { ReorderButton } from "../ReorderButton";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  cancelled: "Cancelled",
  delivered: "Delivered",
  fulfilled: "Shipped",
  on_hold: "On hold",
  paid: "Processing",
  partially_fulfilled: "Processing",
  pending: "Unpaid",
  processing: "Processing",
  refunded: "Refunded",
  shipped: "Shipped",
  unfulfilled: "Unpaid",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const user = await getCurrentUserOrRedirect();
  const { orderId } = await params;

  const order = await db.query.ordersTable.findFirst({
    where: eq(ordersTable.id, orderId),
    with: { items: true },
  });

  if (!order || !user || order.userId !== user.id) {
    notFound();
  }

  const isUnpaid = order.paymentStatus?.toLowerCase() === "pending";

  // eSIM-only: all line items are eSIM (name starts with "eSIM:")
  const isEsimOnlyOrder =
    order.items.length > 0 &&
    order.items.every((i) => (i.name ?? "").startsWith("eSIM:"));

  const esimOrders = isEsimOnlyOrder
    ? await db
        .select({
          activationLink: esimOrdersTable.activationLink,
          id: esimOrdersTable.id,
          packageName: esimOrdersTable.packageName,
          status: esimOrdersTable.status,
        })
        .from(esimOrdersTable)
        .where(eq(esimOrdersTable.orderId, order.id))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Order{" "}
          <span className="font-mono text-muted-foreground">#{order.id}</span>
        </h1>
        {isUnpaid ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/checkout/${order.id}`}>
              <CreditCard aria-hidden className="mr-1.5 size-3.5" />
              Pay Now
            </Link>
          </Button>
        ) : (
          <ReorderButton orderId={order.id} />
        )}
      </div>

      <Card>
        <CardHeader
          className={`
          flex flex-row items-center justify-between space-y-0 pb-2
        `}
        >
          <span className="text-sm font-medium text-muted-foreground capitalize">
            Status
          </span>
          <span>{getOrderStatusLabel(order)}</span>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Placed</span>
            <span>{formatDateLong(order.createdAt)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Payment</span>
            <span>{formatPaymentMethod(order.paymentMethod, order.cryptoCurrency)}</span>
          </div>
          {isCryptoPayment(order.paymentMethod) &&
            order.cryptoAmount != null &&
            order.cryptoCurrency != null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paid (crypto)</span>
                <span className="font-medium">
                  {order.cryptoAmount} {order.cryptoCurrency}
                </span>
              </div>
            )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-medium">{formatCents(order.totalCents)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-medium">Items</h2>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {order.items.map((item) => (
              <li
                className={`
                  flex justify-between border-b pb-3
                  last:border-0 last:pb-0
                `}
                key={item.id}
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Qty {item.quantity} × {formatCents(item.priceCents)}
                  </p>
                </div>
                <span className="font-medium">
                  {formatCents(item.priceCents * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* eSIM details — activate from order page when order is eSIM-only */}
      {esimOrders.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <Smartphone className="size-5 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-medium">eSIM details</h2>
              <p className="text-sm text-muted-foreground">
                Activate your eSIM from this page — tap below to install on this
                device (no QR code needed).
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {esimOrders.map((esim) => (
              <div
                key={esim.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{esim.packageName}</p>
                  <Badge
                    variant={
                      esim.status === "active"
                        ? "default"
                        : esim.status === "failed" || esim.status === "expired"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {esim.status === "active"
                      ? "Ready"
                      : esim.status === "processing" || esim.status === "pending"
                        ? "Preparing"
                        : esim.status}
                  </Badge>
                </div>
                {(esim.status === "active" || esim.status === "processing") &&
                  esim.activationLink && (
                    <Button asChild size="sm" className="w-fit">
                      <a
                        href={esim.activationLink}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Install on this device
                        <ExternalLink className="ml-1.5 size-3.5" />
                      </a>
                    </Button>
                  )}
              </div>
            ))}
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/esim">
                <Smartphone className="mr-1.5 size-3.5" />
                View in eSIM dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tracking information */}
      {order.trackingNumber && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-medium">Tracking</h2>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tracking #</span>
              {order.trackingUrl ? (
                <a
                  className={`
                    font-mono text-blue-600 underline
                    hover:text-blue-800
                  `}
                  href={order.trackingUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {order.trackingNumber}
                </a>
              ) : (
                <span className="font-mono">{order.trackingNumber}</span>
              )}
            </div>
            {order.trackingCarrier && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Carrier</span>
                <span>{order.trackingCarrier}</span>
              </div>
            )}
            {order.shippedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shipped</span>
                <span>{formatDateLong(order.shippedAt)}</span>
              </div>
            )}
            {order.deliveredAt && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivered</span>
                <span>{formatDateLong(order.deliveredAt)}</span>
              </div>
            )}
            {(order.estimatedDeliveryFrom || order.estimatedDeliveryTo) && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Est. delivery</span>
                <span>
                  {order.estimatedDeliveryFrom ?? "?"} –{" "}
                  {order.estimatedDeliveryTo ?? "?"}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getOrderStatusLabel(order: {
  fulfillmentStatus?: null | string;
  paymentStatus?: null | string;
  status?: null | string;
}): string {
  const paymentPending = order.paymentStatus?.toLowerCase() === "pending";
  const paidWithPendingOrder =
    order.paymentStatus?.toLowerCase() === "paid" &&
    order.status?.toLowerCase() === "pending";
  const key = paymentPending
    ? "pending"
    : paidWithPendingOrder
      ? "processing"
      : (order.fulfillmentStatus?.toLowerCase() ??
        order.paymentStatus?.toLowerCase() ??
        order.status?.toLowerCase() ??
        "pending");
  return STATUS_LABELS[key] ?? key;
}

function isCryptoPayment(method: string | undefined): boolean {
  const m = (method ?? "").toLowerCase();
  return (
    m === "solana_pay" ||
    m === "eth_pay" ||
    m === "btcpay" ||
    m === "ton_pay" ||
    m === "crypto"
  );
}

function formatPaymentMethod(
  method: string | undefined,
  cryptoCurrency?: string | null,
): string {
  const m = (method ?? "").toLowerCase();
  if (m === "stripe") return "Credit / Debit card";
  if (m === "solana_pay") {
    const token = (cryptoCurrency ?? "").toUpperCase();
    if (token === "SOL") return "SOL (Solana)";
    if (token) return `${token} (Solana)`;
    return "Solana";
  }
  if (m === "eth_pay") {
    const token = (cryptoCurrency ?? "").toUpperCase();
    if (token === "ETH") return "ETH (Ethereum)";
    if (token) return `${token} (Ethereum)`;
    return "Ethereum";
  }
  if (m === "btcpay") return "Bitcoin";
  if (m === "ton_pay") return "TON";
  if (m === "paypal") return "PayPal";
  if (m === "crypto") return "Crypto";
  return method ?? "—";
}
