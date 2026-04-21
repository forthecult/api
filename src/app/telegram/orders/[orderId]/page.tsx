"use client";

import { Package } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "~/ui/primitives/button";

interface OrderStatusData {
  expiresAt?: string;
  orderId: string;
  paidAt: null | string;
  status: string;
  txHash?: string;
}

interface OrderStatusError {
  error: { code: string };
  success: false;
}

export default function TelegramOrderStatusPage() {
  const params = useParams();
  const orderId = typeof params.orderId === "string" ? params.orderId : "";
  const [data, setData] = useState<null | OrderStatusData>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError("Order ID missing");
      return;
    }
    const base = typeof window !== "undefined" ? window.location.origin : "";
    fetch(`${base}/api/orders/${encodeURIComponent(orderId)}/status`)
      .then((res) => res.json() as Promise<OrderStatusData | OrderStatusError>)
      .then((json) => {
        if ("error" in json) setError(json.error?.code ?? "Unknown error");
        else if ("orderId" in json && "status" in json) setData(json);
      })
      .catch(() => setError("Could not load order"))
      .finally(() => setLoading(false));
  }, [orderId]);

  const statusLabel: Record<string, string> = {
    awaiting_payment: "Awaiting payment",
    cancelled: "Cancelled",
    delivered: "Delivered",
    expired: "Expired",
    paid: "Paid",
    processing: "Processing",
    shipped: "Shipped",
  };

  return (
    <div className="flex min-h-screen flex-col pb-24">
      <header
        className={`
          sticky top-0 z-10 border-b border-[var(--tg-theme-hint-color,#999)]/20
          bg-[var(--tg-theme-bg-color,#fff)] px-4 py-3
        `}
      >
        <h1
          className={`
            text-lg font-semibold text-[var(--tg-theme-text-color,#000)]
          `}
        >
          Order status
        </h1>
      </header>

      <div className="flex-1 px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div
              className={`
                h-8 w-8 animate-spin rounded-full border-2
                border-[var(--tg-theme-hint-color,#999)] border-t-transparent
              `}
            />
            <p className="mt-4 text-sm text-[var(--tg-theme-hint-color,#999)]">
              Loading…
            </p>
          </div>
        ) : error ? (
          <div
            className={`
              rounded-lg border border-red-200 bg-red-50 p-4
              dark:border-red-800 dark:bg-red-950/30
            `}
          >
            <p
              className={`
                text-sm text-red-700
                dark:text-red-300
              `}
            >
              {error}
            </p>
            <Button asChild className="mt-3" size="sm" variant="outline">
              <Link href="/telegram">Back to shop</Link>
            </Button>
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div
              className={`
                flex items-center gap-3 rounded-lg border
                border-[var(--tg-theme-hint-color,#999)]/20
                bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] p-4
              `}
            >
              <Package
                className={`
                  h-8 w-8 shrink-0 text-[var(--tg-theme-button-color,#3390ec)]
                `}
              />
              <div>
                <p
                  className={`
                    font-medium text-[var(--tg-theme-text-color,#000)]
                  `}
                >
                  {statusLabel[data.status] ?? data.status}
                </p>
                <p className="text-xs text-[var(--tg-theme-hint-color,#999)]">
                  Order {data.orderId.slice(0, 8)}
                </p>
              </div>
            </div>
            {data.paidAt && (
              <p className="text-sm text-[var(--tg-theme-hint-color,#999)]">
                Paid at {new Date(data.paidAt).toLocaleString()}
              </p>
            )}
            <Button asChild className="w-full" variant="outline">
              <Link href="/telegram">Back to shop</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
