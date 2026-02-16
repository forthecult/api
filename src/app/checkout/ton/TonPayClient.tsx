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
const TON_LOGO = { alt: "TON", src: "/crypto/ton/ton_logo.svg" };

interface OrderPaymentInfo {
  comment?: string;
  depositAddress?: string;
  email?: string;
  expiresAt: string;
  orderId: string;
  paymentType?: string;
  tonAmount?: string;
  totalCents: number;
}

function normalizeTonOrder(raw: Record<string, unknown>): OrderPaymentInfo {
  return {
    comment: raw.comment as string | undefined,
    depositAddress: raw.depositAddress as string | undefined,
    email: raw.email as string | undefined,
    expiresAt: String(raw.expiresAt ?? ""),
    orderId: String(raw.orderId ?? ""),
    paymentType: raw.paymentType as string | undefined,
    tonAmount: raw.tonAmount as string | undefined,
    totalCents: Number(raw.totalCents) || 0,
  };
}

export function TonPayClient({
  initialOrder,
}: { initialOrder?: Record<string, unknown> } = {}) {
  const params = useParams();
  const router = useRouter();
  const pathId = (params?.invoiceId as string) ?? "";
  const [order, setOrder] = useState<null | OrderPaymentInfo>(() =>
    initialOrder ? normalizeTonOrder(initialOrder) : null,
  );
  const [orderLoading, setOrderLoading] = useState(!initialOrder);
  const [orderError, setOrderError] = useState<null | string>(null);
  const [timeLeft, setTimeLeft] = useState(() =>
    initialOrder?.expiresAt
      ? getInitialTimeLeft(String(initialOrder.expiresAt))
      : EXPIRY_MINUTES * 60,
  );
  const [copied, setCopied] = useState<"address" | "comment" | null>(null);
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
  }, [pathId, initialOrder]);

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
          settled?: boolean;
          status?: string;
        };
        if (data.settled === true) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          try {
            await fetch("/api/checkout/ton-pay/confirm", {
              body: JSON.stringify({ orderId: order.orderId }),
              headers: { "Content-Type": "application/json" },
              method: "POST",
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
        mx-auto w-full max-w-6xl px-4 py-8
        sm:px-5
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
                  alt={TON_LOGO.alt}
                  className="h-8 w-10 shrink-0 object-contain"
                  height={32}
                  src={TON_LOGO.src}
                  width={40}
                />
                <h1
                  className={`
                  text-2xl font-semibold tracking-tight
                  md:text-3xl
                `}
                >
                  Pay with TON
                </h1>
              </div>

              {expired ? (
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
                        Contact support with your order ID and we&apos;ll
                        confirm your payment.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className={`
                    rounded-lg border border-border bg-muted/30 p-4
                  `}
                  >
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
                            <code
                              className={`
                              rounded bg-muted px-2 py-1 font-mono text-xs
                              break-all
                            `}
                            >
                              {depositAddress}
                            </code>
                            <Button
                              className="shrink-0 gap-1"
                              onClick={() =>
                                copyToClipboard(depositAddress, "address")
                              }
                              size="sm"
                              type="button"
                              variant="outline"
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
                            <code
                              className={`
                              rounded bg-muted px-2 py-1 font-mono text-xs
                              break-all
                            `}
                            >
                              {comment}
                            </code>
                            <Button
                              className="shrink-0 gap-1"
                              onClick={() =>
                                copyToClipboard(comment, "comment")
                              }
                              size="sm"
                              type="button"
                              variant="outline"
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
                      <Button asChild className="min-w-[12rem]" size="lg">
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
                        Payment details are missing. Please go back to checkout
                        and try again.
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
                  className={`
                  flex flex-wrap items-center justify-between gap-2
                `}
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
                  className={`
                  flex flex-wrap items-center justify-between gap-2
                `}
                >
                  <dt className="text-muted-foreground">Payment method</dt>
                  <dd className="flex items-center gap-2">
                    <span>TON (Toncoin)</span>
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
                  className={`
                  flex flex-wrap items-center justify-between gap-2
                `}
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
                  <dd className="font-semibold">{tonAmount} TON</dd>
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

function getInitialTimeLeft(expiresAt: null | string): number {
  if (!expiresAt) return EXPIRY_MINUTES * 60;
  const ts = expiresAt.includes("T")
    ? Date.parse(expiresAt)
    : Number(expiresAt);
  if (!Number.isFinite(ts)) return EXPIRY_MINUTES * 60;
  return Math.max(0, Math.floor((ts - Date.now()) / 1000));
}
