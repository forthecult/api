import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { getCurrentUserOrRedirect } from "~/lib/auth";
import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { formatCents, formatDateLong } from "~/lib/format";
import { Card, CardContent, CardHeader } from "~/ui/primitives/card";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  cancelled: "Cancelled",
  delivered: "Delivered",
  fulfilled: "Shipped",
  paid: "Processing",
  pending: "Unpaid",
  processing: "Processing",
  refunded: "Refunded",
  shipped: "Shipped",
  unfulfilled: "Unpaid",
  on_hold: "On hold",
  partially_fulfilled: "Processing",
};

function getOrderStatusLabel(order: {
  fulfillmentStatus?: string | null;
  paymentStatus?: string | null;
  status?: string | null;
}): string {
  const paymentPending =
    order.paymentStatus?.toLowerCase() === "pending";
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Order{" "}
        <span className="font-mono text-muted-foreground">#{order.id}</span>
      </h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <span className="text-sm font-medium capitalize text-muted-foreground">
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
                key={item.id}
                className="flex justify-between border-b pb-3 last:border-0 last:pb-0"
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
                  href={order.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-blue-600 underline hover:text-blue-800"
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
                  {order.estimatedDeliveryFrom ?? "?"} – {order.estimatedDeliveryTo ?? "?"}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
