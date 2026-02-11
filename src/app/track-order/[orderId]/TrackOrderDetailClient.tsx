"use client";

import { formatDateLong } from "~/lib/format";
import { Card, CardContent, CardHeader } from "~/ui/primitives/card";
import { Button } from "~/ui/primitives/button";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type OrderDetail = {
  orderId: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  email?: string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    priceUsd: number;
    subtotalUsd: number;
  }>;
  shipping?: {
    name?: string;
    address1?: string;
    address2?: string;
    city?: string;
    stateCode?: string;
    zip?: string;
    countryCode?: string;
    phone?: string;
  };
  totals: {
    subtotalUsd: number;
    shippingUsd: number;
    totalUsd: number;
  };
  tracking?: {
    trackingNumber?: string;
    trackingUrl?: string;
    carrier?: string;
    shippedAt?: string;
    deliveredAt?: string;
    estimatedDeliveryFrom?: string;
    estimatedDeliveryTo?: string;
  };
};

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  expired: "Expired",
  paid: "Paid",
  shipped: "Shipped",
  fulfilled: "Shipped",
  cancelled: "Cancelled",
};

export function TrackOrderDetailClient({
  orderId,
  token,
}: {
  orderId: string;
  token: string | null;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!token) {
      setError("This link is invalid or has expired.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/track?t=${encodeURIComponent(token)}`,
      );
      const data = (await res.json().catch(() => ({}))) as
        | OrderDetail
        | { error?: { code?: string; message?: string } };
      if (!res.ok) {
        const err = data as { error?: { message?: string } };
        setError(err.error?.message ?? "Could not load order.");
        setOrder(null);
        return;
      }
      setOrder(data as OrderDetail);
      setError(null);
    } catch {
      setError("Could not load order.");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, token]);

  useEffect(() => {
    void fetchOrder();
  }, [fetchOrder]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p>Loading order…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-6 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{error ?? "Order not found."}</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/track-order">Look up another order</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusLabel = STATUS_LABELS[order.status] ?? order.status;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Order <span className="font-mono text-muted-foreground">#{order.orderId}</span>
        </h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/track-order">Track another order</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <span className="text-sm font-medium text-muted-foreground">Status</span>
          <span>{statusLabel}</span>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Placed</span>
            <span>{formatDateLong(order.createdAt)}</span>
          </div>
          {order.paidAt && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Paid</span>
              <span>{formatDateLong(order.paidAt)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-medium">
              {new Intl.NumberFormat("en-US", {
                currency: "USD",
                style: "currency",
              }).format(order.totals.totalUsd)}
            </span>
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
                key={`${item.productId}-${item.name}`}
                className="flex justify-between border-b pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Qty {item.quantity} ×{" "}
                    {new Intl.NumberFormat("en-US", {
                      currency: "USD",
                      style: "currency",
                    }).format(item.priceUsd)}
                  </p>
                </div>
                <span className="font-medium">
                  {new Intl.NumberFormat("en-US", {
                    currency: "USD",
                    style: "currency",
                  }).format(item.subtotalUsd)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Tracking information */}
      {order.tracking?.trackingNumber && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-medium">Tracking</h2>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tracking #</span>
              {order.tracking.trackingUrl ? (
                <a
                  href={order.tracking.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-blue-600 underline hover:text-blue-800"
                >
                  {order.tracking.trackingNumber}
                </a>
              ) : (
                <span className="font-mono">{order.tracking.trackingNumber}</span>
              )}
            </div>
            {order.tracking.carrier && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Carrier</span>
                <span>{order.tracking.carrier}</span>
              </div>
            )}
            {order.tracking.shippedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shipped</span>
                <span>{formatDateLong(order.tracking.shippedAt)}</span>
              </div>
            )}
            {order.tracking.deliveredAt && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivered</span>
                <span>{formatDateLong(order.tracking.deliveredAt)}</span>
              </div>
            )}
            {(order.tracking.estimatedDeliveryFrom || order.tracking.estimatedDeliveryTo) && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Est. delivery</span>
                <span>
                  {order.tracking.estimatedDeliveryFrom ?? "?"} – {order.tracking.estimatedDeliveryTo ?? "?"}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {order.shipping &&
        (order.shipping.address1 ||
          order.shipping.city ||
          order.shipping.countryCode) && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-medium">Shipping address</h2>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {order.shipping.name && <p className="font-medium text-foreground">{order.shipping.name}</p>}
              <p>
                {[
                  order.shipping.address1,
                  order.shipping.address2,
                  [
                    order.shipping.city,
                    order.shipping.stateCode,
                  ]
                    .filter(Boolean)
                    .join(", "),
                  order.shipping.zip,
                  order.shipping.countryCode,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {order.shipping.phone && (
                <p className="mt-1">Phone: {order.shipping.phone}</p>
              )}
            </CardContent>
          </Card>
        )}

      <p className="text-center text-sm text-muted-foreground">
        Need help? <Link href="/contact" className="underline hover:text-foreground">Contact us</Link>.
      </p>
    </div>
  );
}
