"use client";

import { AlertCircle, Clock, Copy, Info, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useCurrentUser } from "~/lib/auth-client";
import { buildTonTransferUrl } from "~/lib/ton-pay";
import { Button } from "~/ui/primitives/button";

const EXPIRY_MINUTES = 60;
const TON_LOGO = { src: "/crypto/ton/ton_logo.svg", alt: "TON" };

function getInitialTimeLeft(expiresAt: string | null): number {
  if (!expiresAt) return EXPIRY_MINUTES * 60;
  const ts = expiresAt.includes("T")
    ? Date.parse(expiresAt)
    : Number(expiresAt);
  if (!Number.isFinite(ts)) return EXPIRY_MINUTES * 60;
  return Math.max(0, Math.floor((ts - Date.now()) / 1000));
}

type OrderPaymentInfo = {
  orderId: string;
  totalCents: number;
  email?: string;
  expiresAt: string;
  paymentType?: string;
  depositAddress?: string;
  tonAmount?: string;
  comment?: string;
};

export function TonPayClient() {
  const params = useParams();
  const router = useRouter();
  const pathId = (params?.invoiceId as string) ?? "";
  const [order, setOrder] = useState<OrderPaymentInfo | null>(null);
  const [orderLoading, setOrderLoading] = useState(true);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(EXPIRY_MINUTES * 60);
  const [copied, setCopied] = useState<"address" | "comment" | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user } = useCurrentUser();

  useEffect(() => {
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
      .then((data: OrderPaymentInfo) => {
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
  }, [pathId]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  useEffect(() => {
    if (!order?.orderId || timeLeft <= 0) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/checkout/ton-pay/status?orderId=${encodeURIComponent(order.orderId)}`,
        );
        const data = (await res.json()) as {
          status?: string;
          settled?: boolean;
        };
        if (data.settled === true) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          try {
            await fetch("/api/checkout/ton-pay/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: order.orderId }),
            });
          } catch {
            // order may already be confirmed
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
  }, [order?.orderId, timeLeft, router]);

  const copyToClipboard = useCallback(
    (text: string, kind: "address" | "comment") => {
      void navigator.clipboard.writeText(text).then(() => {
        setCopied(kind);
        setTimeout(() => setCopied(null), 2000);
      });
    },
    [],
  );

  const amountUsd = order ? order.totalCents / 100 : 0;
  const amountUsdStr = amountUsd.toFixed(2);
  const expired = timeLeft <= 0;
  const depositAddress = order?.depositAddress?.trim() ?? "";
  const tonAmount = order?.tonAmount?.trim() ?? "0";
  const comment = order?.comment ?? order?.orderId ?? "";
  const email = user?.email ?? order?.email ?? "";
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const expiryDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const tonTransferUrl =
    depositAddress && tonAmount
      ? buildTonTransferUrl({
          address: depositAddress,
          amountTon: tonAmount,
          comment,
        })
      : null;

  const handleRecreateOrder = useCallback(() => {
    router.push("/checkout");
  }, [router]);

  if (!pathId?.trim()) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Missing order. Start checkout from your cart.
          </p>
          <Link
            href="/checkout"
            className="text-primary underline hover:underline"
          >
            Back to checkout
          </Link>
        </div>
      </div>
    );
  }

  if (orderLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading order…</p>
      </div>
    );
  }

  if (orderError || !order) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {orderError ?? "Order not found"}
          </p>
          <Link
            href="/checkout"
            className="text-primary underline hover:underline"
          >
            Back to checkout
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link
              href="/checkout"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Back to checkout"
            >
              <svg
                className="size-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
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

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-5">
        <div className="flex min-w-0 flex-col gap-6 min-[560px]:flex-row min-[560px]:items-start">
          <div className="min-w-0 flex-1 rounded-xl border border-border bg-card p-6 min-[560px]:min-w-[560px]">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Image
                  alt={TON_LOGO.alt}
                  className="h-8 w-10 shrink-0 object-contain"
                  height={32}
                  src={TON_LOGO.src}
                  width={40}
                />
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  Pay with TON
                </h1>
              </div>

              {expired ? (
                <div className="flex flex-col gap-6">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <Clock
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden
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
                      variant="secondary"
                      size="lg"
                      type="button"
                      onClick={handleRecreateOrder}
                    >
                      Recreate order
                    </Button>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
                    <Info
                      className="size-5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <div>
                      <p className="font-semibold">If you already paid</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Contact support with your order ID and we&apos;ll
                        confirm your payment.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <h2 className="mb-4 text-base font-semibold">
                      Payment details
                    </h2>
                    <div className="space-y-4">
                      <div className="text-sm">
                        <p className="mb-1 text-muted-foreground">
                          Amount to pay
                        </p>
                        <p className="font-mono font-medium">{tonAmount} TON</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          ≈ USD {amountUsdStr}
                        </p>
                      </div>
                      <div className="text-sm">
                        <p className="mb-1 text-muted-foreground">Expires in</p>
                        <p className="font-mono font-medium tabular-nums">
                          {expiryDisplay}
                        </p>
                      </div>
                      {depositAddress && (
                        <div className="text-sm">
                          <p className="mb-1 text-muted-foreground">
                            Wallet address
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="break-all rounded bg-muted px-2 py-1 font-mono text-xs">
                              {depositAddress}
                            </code>
                            <Button
                              size="sm"
                              variant="outline"
                              type="button"
                              onClick={() =>
                                copyToClipboard(depositAddress, "address")
                              }
                              className="shrink-0 gap-1"
                            >
                              <Copy className="size-3.5" />
                              {copied === "address" ? "Copied" : "Copy"}
                            </Button>
                          </div>
                        </div>
                      )}
                      {comment && (
                        <div className="text-sm">
                          <p className="mb-1 text-muted-foreground">
                            Comment (include in transfer)
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="break-all rounded bg-muted px-2 py-1 font-mono text-xs">
                              {comment}
                            </code>
                            <Button
                              size="sm"
                              variant="outline"
                              type="button"
                              onClick={() =>
                                copyToClipboard(comment, "comment")
                              }
                              className="shrink-0 gap-1"
                            >
                              <Copy className="size-3.5" />
                              {copied === "comment" ? "Copied" : "Copy"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {tonTransferUrl ? (
                    <div className="flex flex-col gap-4">
                      <Button size="lg" className="min-w-[12rem]" asChild>
                        <a
                          href={tonTransferUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          Open in TON wallet
                        </a>
                      </Button>
                      <p className="text-sm text-muted-foreground">
                        Send exactly <strong>{tonAmount} TON</strong> to the
                        address above and use the comment so we can match your
                        payment. This page will update when payment is received.
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2
                          className="size-4 animate-spin shrink-0"
                          aria-hidden
                        />
                        Waiting for payment…
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
                      <AlertCircle className="size-5 shrink-0 text-amber-600 dark:text-amber-500" />
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Payment details are missing. Please go back to checkout
                        and try again.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="min-w-0 shrink-0 min-[560px]:w-[510px] min-[560px]:sticky min-[560px]:top-8 min-[560px]:self-start">
            <div className="rounded-xl border border-border bg-card px-6 py-5">
              <h2 className="mb-4 text-xl font-semibold">Order details</h2>
              <dl className="space-y-3 text-base">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Email address</dt>
                  <dd className="flex items-center gap-2">
                    <span>{email || "—"}</span>
                    {!user?.email && (
                      <button
                        type="button"
                        onClick={() => router.push("/checkout")}
                        className="text-primary underline hover:underline"
                      >
                        Change
                      </button>
                    )}
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Payment method</dt>
                  <dd className="flex items-center gap-2">
                    <span>TON (Toncoin)</span>
                    <button
                      type="button"
                      onClick={() => router.push("/checkout")}
                      className="text-primary underline hover:underline"
                    >
                      Change
                    </button>
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Order ID</dt>
                  <dd>
                    <code className="break-all font-mono text-xs">
                      {pathId || "—"}
                    </code>
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <dt className="text-muted-foreground">Fiat value</dt>
                  <dd className="font-medium">USD {amountUsdStr}</dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-lg">
                  <dt className="font-medium">Total</dt>
                  <dd className="font-semibold">{tonAmount} TON</dd>
                </div>
              </dl>
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Info
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                Payment is processed on the TON blockchain. Include the comment
                in your transfer so we can match your payment to this order.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
