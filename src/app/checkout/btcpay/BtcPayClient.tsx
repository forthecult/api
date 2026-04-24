"use client";

import { AlertCircle, Clock, Info, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useCurrentUser } from "~/lib/auth-client";
import { Button } from "~/ui/primitives/button";

const EXPIRY_MINUTES = 60;

const PAYMENT_LOGO: Record<string, { alt: string; src: string }> = {
  bitcoin: { alt: "Bitcoin", src: "/crypto/bitcoin/bitcoin-logo.svg" },
  doge: { alt: "Dogecoin", src: "/crypto/bitcoin/bitcoin-logo.svg" },
  dogecoin: { alt: "Dogecoin", src: "/crypto/bitcoin/bitcoin-logo.svg" },
  monero: { alt: "Monero", src: "/crypto/monero/monero-xmr-logo.svg" },
};

const PAYMENT_TITLE: Record<string, string> = {
  bitcoin: "Pay with Bitcoin",
  doge: "Pay with Dogecoin",
  dogecoin: "Pay with Dogecoin",
  monero: "Pay with Monero",
};

interface OrderPaymentInfo {
  btcpayInvoiceId?: string;
  btcpayInvoiceUrl?: string;
  email?: string;
  expiresAt: string;
  orderId: string;
  paymentType?: string;
  token?: string;
  totalCents: number;
}

export function BtcPayClient({
  initialOrder,
}: {
  initialOrder?: Record<string, unknown>;
} = {}) {
  const params = useParams();
  const router = useRouter();
  const pathId = (params?.invoiceId as string) ?? "";
  const [order, setOrder] = useState<null | OrderPaymentInfo>(() =>
    initialOrder ? normalizeBtcOrder(initialOrder) : null,
  );
  const [orderLoading, setOrderLoading] = useState(!initialOrder);
  const [orderError, setOrderError] = useState<null | string>(null);
  const [timeLeft, setTimeLeft] = useState(() =>
    initialOrder?.expiresAt
      ? getInitialTimeLeft(String(initialOrder.expiresAt))
      : EXPIRY_MINUTES * 60,
  );
  const pollRef = useRef<null | ReturnType<typeof setInterval>>(null);
  const { user } = useCurrentUser();

  useEffect(() => {
    if (initialOrder) return;
    if (!pathId?.trim()) {
      setOrderLoading(false);
      setOrderError("Missing order");
      return;
    }
    let cancelled = false;
    setOrderLoading(true);
    setOrderError(null);
    fetch(`/api/checkout/orders/${encodeURIComponent(pathId)}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error("Order not found");
          throw new Error("Failed to load order");
        }
        return res.json();
      })
      .then((raw: unknown) => {
        const data = raw as OrderPaymentInfo;
        if (!cancelled) {
          setOrder(data);
          setTimeLeft(getInitialTimeLeft(data.expiresAt));
        }
      })
      .catch((err) => {
        if (!cancelled)
          setOrderError(
            err instanceof Error ? err.message : "Failed to load order",
          );
      })
      .finally(() => {
        if (!cancelled) setOrderLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pathId, initialOrder]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  useEffect(() => {
    if (!order?.orderId || !order.btcpayInvoiceId || timeLeft <= 0) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/checkout/btcpay/status?orderId=${encodeURIComponent(order.orderId)}`,
        );
        const data = (await res.json()) as {
          settled?: boolean;
          status?: string;
        };
        if (data.settled === true) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          try {
            await fetch("/api/checkout/btcpay/confirm", {
              body: JSON.stringify({ orderId: order.orderId }),
              headers: { "Content-Type": "application/json" },
              method: "POST",
            });
          } catch {
            // order may already be confirmed by webhook
          }
          router.push(
            `/checkout/success?orderId=${encodeURIComponent(order.orderId)}`,
          );
        }
      } catch {
        // keep polling
      }
    }, 2000);
    pollRef.current = interval;
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [order?.orderId, order?.btcpayInvoiceId, timeLeft, router]);

  const amountUsd = order ? order.totalCents / 100 : 0;
  const amountUsdStr = amountUsd.toFixed(2);
  const expired = timeLeft <= 0;
  const token = (order?.token ?? "bitcoin").toLowerCase();
  const logo = PAYMENT_LOGO[token] ?? PAYMENT_LOGO.bitcoin;
  const title = PAYMENT_TITLE[token] ?? PAYMENT_TITLE.bitcoin;
  const invoiceUrl = order?.btcpayInvoiceUrl?.trim();
  const notConfigured =
    order && !order.btcpayInvoiceId && !order.btcpayInvoiceUrl;
  const email = user?.email ?? order?.email ?? "";
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const expiryDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  const handleRecreateOrder = useCallback(() => {
    router.push("/checkout");
  }, [router]);

  if (!pathId?.trim()) {
    return (
      <div
        className={`
          flex min-h-screen w-full items-center justify-center bg-background
        `}
      >
        <div
          className={`
            flex flex-col gap-4 rounded-lg border border-border bg-card p-6
            text-center
          `}
        >
          <p className="text-sm text-muted-foreground">
            Missing order. Start checkout from your cart.
          </p>
          <Link
            className={`
              text-primary underline
              hover:underline
            `}
            href="/checkout"
          >
            Back to checkout
          </Link>
        </div>
      </div>
    );
  }

  if (orderLoading) {
    return (
      <div
        className={`
          flex min-h-screen w-full items-center justify-center bg-background
        `}
      >
        <p className="text-sm text-muted-foreground">Loading order…</p>
      </div>
    );
  }

  if (orderError || !order) {
    return (
      <div
        className={`
          flex min-h-screen w-full items-center justify-center bg-background
        `}
      >
        <div
          className={`
            flex flex-col gap-4 rounded-lg border border-border bg-card p-6
            text-center
          `}
        >
          <p className="text-sm text-muted-foreground">
            {orderError ?? "Order not found"}
          </p>
          <Link
            className={`
              text-primary underline
              hover:underline
            `}
            href="/checkout"
          >
            Back to checkout
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background">
      <header
        className={`
          sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur
          supports-[backdrop-filter]:bg-background/60
        `}
      >
        <div
          className={`
            container mx-auto max-w-7xl px-4
            sm:px-6
            lg:px-8
          `}
        >
          <div className="flex h-16 items-center justify-between">
            <Link
              aria-label="Back to checkout"
              className={`
                rounded p-1 text-muted-foreground
                hover:bg-muted hover:text-foreground
              `}
              href="/checkout"
            >
              <svg
                aria-hidden
                className="size-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M15 19l-7-7 7-7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </Link>
            <Link className="flex items-center gap-2" href="/">
              <span className="text-xl font-bold tracking-tight text-foreground">
                Culture
              </span>
            </Link>
            <div className="w-10" />
          </div>
        </div>
      </header>

      <div
        className={`
          mx-auto w-full max-w-7xl px-4 py-8
          sm:px-5 sm:px-6
          lg:px-8
        `}
      >
        <div
          className={`
            flex min-w-0 flex-col gap-6
            min-[560px]:flex-row min-[560px]:items-start
          `}
        >
          <div
            className={`
              min-w-0 flex-1 rounded-xl border border-border bg-card p-6
              min-[560px]:min-w-[560px]
            `}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Image
                  alt={logo.alt}
                  className="h-8 w-10 shrink-0 object-contain"
                  height={32}
                  src={logo.src}
                  width={40}
                />
                <h1
                  className={`
                    text-2xl font-semibold tracking-tight
                    md:text-3xl
                  `}
                >
                  {title}
                </h1>
              </div>

              {notConfigured ? (
                <div
                  className={`
                    flex flex-col gap-6 rounded-lg border border-amber-500/40
                    bg-amber-500/10 p-4
                  `}
                >
                  <p
                    className={`
                      text-sm font-medium text-amber-800
                      dark:text-amber-200
                    `}
                  >
                    BTCPay Server is not configured yet. When it is, you’ll be
                    able to pay with Bitcoin, Dogecoin, or Monero here.
                  </p>
                  <Link
                    className={`
                      text-primary underline
                      hover:underline
                    `}
                    href="/checkout"
                  >
                    Back to checkout
                  </Link>
                </div>
              ) : expired ? (
                <div className="flex flex-col gap-6">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <Clock
                        aria-hidden
                        className="size-5 shrink-0 text-muted-foreground"
                      />
                      <h2 className="text-lg font-semibold">
                        Payment not received in time
                      </h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      The payment window has expired. Please recreate your order
                      to get a new payment link.
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <Button
                      onClick={handleRecreateOrder}
                      size="lg"
                      type="button"
                      variant="secondary"
                    >
                      Recreate order
                    </Button>
                  </div>
                  <div
                    className={`
                      flex items-start gap-3 rounded-lg border border-border
                      bg-muted/30 p-4
                    `}
                  >
                    <Info
                      aria-hidden
                      className="size-5 shrink-0 text-muted-foreground"
                    />
                    <div>
                      <p className="font-semibold">If you already paid</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Contact support with your order ID and we’ll confirm
                        your payment.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className={`rounded-lg border border-border bg-muted/30 p-4`}
                  >
                    <h2 className="mb-4 text-base font-semibold">
                      Payment details
                    </h2>
                    <div className="flex flex-col gap-4">
                      <div className="text-sm">
                        <p className="mb-1.5 text-base font-medium text-foreground">
                          Amount to pay
                        </p>
                        <p className="font-medium">USD {amountUsdStr}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          You’ll see the exact crypto amount on the BTCPay
                          payment page (Bitcoin, Dogecoin, or Monero).
                        </p>
                      </div>
                      <div className="text-sm">
                        <p className="mb-1.5 text-base font-medium text-foreground">
                          Expires in
                        </p>
                        <p className="font-mono font-medium tabular-nums">
                          {expiryDisplay}
                        </p>
                      </div>
                    </div>
                  </div>

                  {invoiceUrl ? (
                    <div className="flex flex-col gap-4">
                      <Button asChild className="min-w-[12rem]" size="lg">
                        <a
                          href={invoiceUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          Open payment page
                        </a>
                      </Button>
                      <p className="text-sm text-muted-foreground">
                        Complete payment on the BTCPay page. This page will
                        update automatically when payment is received.
                      </p>
                      <div
                        className={`
                          flex items-center gap-2 text-sm text-muted-foreground
                        `}
                      >
                        <Loader2
                          aria-hidden
                          className="size-4 shrink-0 animate-spin"
                        />
                        Waiting for payment…
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`
                        flex items-center gap-3 rounded-lg border
                        border-amber-500/40 bg-amber-500/10 p-4
                      `}
                    >
                      <AlertCircle
                        className={`
                          size-5 shrink-0 text-amber-600
                          dark:text-amber-500
                        `}
                      />
                      <p
                        className={`
                          text-sm font-medium text-amber-800
                          dark:text-amber-200
                        `}
                      >
                        Payment link is missing. Please go back to checkout and
                        try again.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div
            className={`
              min-w-0 shrink-0
              min-[560px]:sticky min-[560px]:top-8 min-[560px]:w-[510px]
              min-[560px]:self-start
            `}
          >
            <div className="rounded-xl border border-border bg-card px-6 py-5">
              <h2 className="mb-4 text-xl font-semibold">Order details</h2>
              <dl className="space-y-3 text-base">
                <div
                  className={`flex flex-wrap items-center justify-between gap-2`}
                >
                  <dt className="text-muted-foreground">Email address</dt>
                  <dd className="flex items-center gap-2">
                    <span>{email || "—"}</span>
                    {!user?.email && (
                      <button
                        className={`
                          text-primary underline
                          hover:underline
                        `}
                        onClick={() => router.push("/checkout")}
                        type="button"
                      >
                        Change
                      </button>
                    )}
                  </dd>
                </div>
                <div
                  className={`flex flex-wrap items-center justify-between gap-2`}
                >
                  <dt className="text-muted-foreground">Payment method</dt>
                  <dd className="flex items-center gap-2">
                    <span>{title}</span>
                    <button
                      className={`
                        text-primary underline
                        hover:underline
                      `}
                      onClick={() => router.push("/checkout")}
                      type="button"
                    >
                      Change
                    </button>
                  </dd>
                </div>
                <div
                  className={`flex flex-wrap items-center justify-between gap-2`}
                >
                  <dt className="text-muted-foreground">Order ID</dt>
                  <dd>
                    <code className="font-mono text-xs break-all">
                      {pathId || "—"}
                    </code>
                  </dd>
                </div>
                <div
                  className={`
                    flex flex-wrap items-center justify-between gap-2 border-t
                    border-border pt-3
                  `}
                >
                  <dt className="text-muted-foreground">Fiat value</dt>
                  <dd className="font-medium">USD {amountUsdStr}</dd>
                </div>
                <div
                  className={`
                    flex flex-wrap items-center justify-between gap-2 text-lg
                  `}
                >
                  <dt className="font-medium">Total</dt>
                  <dd className="font-semibold">USD {amountUsdStr}</dd>
                </div>
              </dl>
              <p
                className={`
                  mt-4 flex items-center gap-2 text-sm text-muted-foreground
                `}
              >
                <Info
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
                Payment is processed by BTCPay Server. You can pay with Bitcoin,
                Dogecoin, or Monero.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getInitialTimeLeft(expiresAt: null | string): number {
  if (!expiresAt) return EXPIRY_MINUTES * 60;
  const ts = expiresAt.includes("T")
    ? Date.parse(expiresAt)
    : Number(expiresAt);
  if (!Number.isFinite(ts)) return EXPIRY_MINUTES * 60;
  return Math.max(0, Math.floor((ts - Date.now()) / 1000));
}

function normalizeBtcOrder(raw: Record<string, unknown>): OrderPaymentInfo {
  return {
    btcpayInvoiceId: raw.btcpayInvoiceId as string | undefined,
    btcpayInvoiceUrl: raw.btcpayInvoiceUrl as string | undefined,
    email: raw.email as string | undefined,
    expiresAt: String(raw.expiresAt ?? ""),
    orderId: String(raw.orderId ?? ""),
    paymentType: raw.paymentType as string | undefined,
    token: raw.token as string | undefined,
    totalCents: Number(raw.totalCents) || 0,
  };
}
