"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { SEO_CONFIG } from "~/app";
import { Button } from "~/ui/primitives/button";
import { Spinner } from "~/ui/primitives/spinner";

interface OrderPayload {
  createdAt: string;
  email?: string;
  items: {
    name: string;
    priceUsd?: number;
    quantity: number;
    subtotalUsd?: number;
  }[];
  orderId: string;
  shipping?: {
    address1?: string;
    address2?: string;
    city?: string;
    countryCode?: string;
    name?: string;
    phone?: string;
    stateCode?: string;
    zip?: string;
  };
  totals?: { shippingUsd?: number; subtotalUsd?: number; totalUsd?: number };
}

export function InvoicePrintClient({ orderId }: { orderId: string }) {
  const searchParams = useSearchParams();
  const ct = searchParams.get("ct");
  const [order, setOrder] = useState<null | OrderPayload>(null);
  const [error, setError] = useState<null | string>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = ct ? `?ct=${encodeURIComponent(ct)}` : "";
        const res = await fetch(
          `/api/orders/${encodeURIComponent(orderId)}${q}`,
          { credentials: "include" },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: { message?: string };
          };
          throw new Error(body.error?.message ?? "Could not load order");
        }
        const data = (await res.json()) as OrderPayload;
        if (!cancelled) setOrder(data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not load order");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, ct]);

  const print = useCallback(() => {
    window.print();
  }, []);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-destructive">{error}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Open this invoice from your order confirmation link, or sign in and
          open it from your account.
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex justify-center py-24">
        <Spinner variant="page" />
      </div>
    );
  }

  const subtotal =
    order.totals?.subtotalUsd ??
    order.items.reduce(
      (s, i) => s + (i.subtotalUsd ?? (i.priceUsd ?? 0) * i.quantity),
      0,
    );
  const total =
    order.totals?.totalUsd ?? subtotal + (order.totals?.shippingUsd ?? 0);
  const ship = order.totals?.shippingUsd ?? 0;

  return (
    <div
      className={`
        mx-auto max-w-3xl px-4 py-8
        print:max-w-none print:py-4
      `}
    >
      <div
        className={`
          mb-6 flex flex-wrap items-center justify-between gap-3
          print:hidden
        `}
      >
        <h1 className="text-lg font-semibold">Invoice</h1>
        <Button onClick={print} type="button" variant="default">
          Print / Save as PDF
        </Button>
      </div>

      <div
        className={`
          rounded-lg border border-border bg-card p-6
          print:border-0 print:p-0
        `}
      >
        <header className="flex flex-col gap-1 border-b border-border pb-4">
          <p className="text-sm font-medium">{SEO_CONFIG.fullName}</p>
          <p className="text-xs text-muted-foreground">Order {order.orderId}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(order.createdAt).toLocaleString()}
          </p>
          {order.email ? (
            <p className="text-xs text-muted-foreground">{order.email}</p>
          ) : null}
        </header>

        {order.shipping?.name || order.shipping?.address1 ? (
          <section className="mt-4 text-sm">
            <p className="font-medium">Ship to</p>
            <p className="mt-1 text-muted-foreground">
              {order.shipping.name}
              <br />
              {order.shipping.address1}
              {order.shipping.address2 ? (
                <>
                  <br />
                  {order.shipping.address2}
                </>
              ) : null}
              <br />
              {order.shipping.city}
              {order.shipping.stateCode ? `, ${order.shipping.stateCode}` : ""}{" "}
              {order.shipping.zip}
              <br />
              {order.shipping.countryCode}
              {order.shipping.phone ? (
                <>
                  <br />
                  {order.shipping.phone}
                </>
              ) : null}
            </p>
          </section>
        ) : null}

        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr
              className={`
                border-b border-border text-xs text-muted-foreground uppercase
              `}
            >
              <th className="py-2 pr-2">Item</th>
              <th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 text-right">Line</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i, idx) => (
              <tr
                className="border-b border-border/60"
                key={`${i.name}-${idx}`}
              >
                <td className="py-2 pr-2">{i.name}</td>
                <td className="py-2 pr-2 text-right tabular-nums">
                  {i.quantity}
                </td>
                <td className="py-2 text-right tabular-nums">
                  $
                  {(i.subtotalUsd ?? (i.priceUsd ?? 0) * i.quantity).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex flex-col items-end gap-1 text-sm">
          <div className="flex w-full max-w-xs justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex w-full max-w-xs justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <span className="tabular-nums">${ship.toFixed(2)}</span>
          </div>
          <div
            className={`
              flex w-full max-w-xs justify-between border-t border-border pt-2
              font-semibold
            `}
          >
            <span>Total (USD)</span>
            <span className="tabular-nums">${total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
