"use client";

import {
  Check,
  Link2,
  Loader2,
  Mail,
  Package,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SEO_CONFIG } from "~/app";
import { trackPurchase } from "~/lib/analytics/ecommerce";
import {
  requestPasswordReset,
  signUp,
  useCurrentUser,
} from "~/lib/auth-client";
import { useCart } from "~/lib/hooks/use-cart";
import { isRealEmail } from "~/lib/is-real-email";
import { Button } from "~/ui/primitives/button";
import { Checkbox } from "~/ui/primitives/checkbox";
import { Input } from "~/ui/primitives/input";

const X_ICON = (
  <svg
    aria-hidden
    fill="currentColor"
    height="18"
    viewBox="0 0 24 24"
    width="18"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

type AccessLevel = "admin" | "first_visit" | "owner" | "public";

interface OrderDetails {
  accessLevel?: AccessLevel;
  createdAt: string;
  cryptoCurrency?: string;
  email?: string;
  items: {
    name: string;
    priceUsd?: number;
    productId?: null | string;
    quantity: number;
    subtotalUsd?: number;
  }[];
  orderId: string;
  paymentMethod?: string;
  shipping?: ShippingAddress;
  totalCents: number;
}

interface ShippingAddress {
  address1?: string;
  address2?: string;
  city?: string;
  countryCode?: string;
  name?: string;
  phone?: string;
  stateCode?: string;
  zip?: string;
}

/* ---------- Main success page ---------- */
export function SuccessPageClient() {
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get("orderId");
  const sessionIdParam = searchParams.get("session_id");
  const { clearCart } = useCart();
  const { user } = useCurrentUser();

  const [order, setOrder] = useState<null | OrderDetails>(null);
  const [loading, setLoading] = useState(true);
  const purchaseFired = useRef(false);

  useEffect(() => {
    if (orderIdParam || sessionIdParam) {
      clearCart();
    }
  }, [orderIdParam, sessionIdParam, clearCart]);

  useEffect(() => {
    if (!order || purchaseFired.current) return;
    purchaseFired.current = true;
    const valueUsd = order.totalCents / 100;
    trackPurchase({
      currency: "USD",
      items: order.items.map((i) => ({
        priceUsd:
          i.priceUsd ??
          (i.subtotalUsd != null && i.quantity > 0
            ? i.subtotalUsd / i.quantity
            : undefined),
        productId: i.productId ?? null,
        quantity: i.quantity,
        title: i.name,
      })),
      orderId: order.orderId,
      valueUsd,
    });
  }, [order]);

  /** If user opted to save address at checkout, save it now. */
  useEffect(() => {
    if (loading || !order?.shipping || !user?.id) return;
    if (
      typeof window === "undefined" ||
      sessionStorage.getItem("checkout_save_address") !== "1"
    )
      return;
    const s = order.shipping;
    if (
      !s.address1?.trim() ||
      !s.city?.trim() ||
      !s.countryCode?.trim() ||
      !s.zip?.trim()
    )
      return;

    sessionStorage.removeItem("checkout_save_address");
    fetch("/api/user/addresses", {
      body: JSON.stringify({
        address1: s.address1.trim(),
        address2: s.address2?.trim() || undefined,
        city: s.city.trim(),
        countryCode: s.countryCode.trim(),
        phone: s.phone?.trim() || undefined,
        stateCode: s.stateCode?.trim() || undefined,
        zip: s.zip.trim(),
      }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
      .then((res) => {
        if (res.ok) toast.success("Address saved for next time");
      })
      .catch(() => {});
  }, [loading, order?.shipping, user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function fetchOrder() {
      if (sessionIdParam) {
        // Stripe flow: use session_id, pass confirmation token if available
        const ct = consumeConfirmationToken("checkout_stripe_ct");
        const ctParam = ct ? `&ct=${encodeURIComponent(ct)}` : "";
        const res = await fetch(
          `/api/orders/by-session?session_id=${encodeURIComponent(sessionIdParam)}${ctParam}`,
        );
        if (!cancelled && res.ok) {
          const data = (await res.json()) as OrderDetails;
          setOrder(data);
        }
      } else if (orderIdParam) {
        // Crypto/direct flow: use orderId, pass confirmation token if available
        const ct = consumeConfirmationToken(`checkout_ct_${orderIdParam}`);
        const ctParam = ct ? `?ct=${encodeURIComponent(ct)}` : "";
        const res = await fetch(
          `/api/orders/${encodeURIComponent(orderIdParam)}${ctParam}`,
          {
            credentials: "include",
          },
        );
        if (!cancelled && res.ok) {
          const data = (await res.json()) as {
            accessLevel?: AccessLevel;
            createdAt: string;
            cryptoCurrency?: string;
            email?: string;
            items: {
              name: string;
              priceUsd?: number;
              quantity: number;
              subtotalUsd?: number;
            }[];
            orderId: string;
            paymentMethod?: string;
            shipping?: ShippingAddress;
            totals?: { totalUsd: number };
          };
          setOrder({
            accessLevel: (data as { accessLevel?: AccessLevel }).accessLevel,
            createdAt: data.createdAt,
            cryptoCurrency: data.cryptoCurrency,
            email: data.email,
            items: (data.items ?? []).map((i) => ({
              name: i.name,
              priceUsd: i.priceUsd,
              productId: (i as { productId?: null | string }).productId,
              quantity: i.quantity,
              subtotalUsd: i.subtotalUsd,
            })),
            orderId: data.orderId,
            paymentMethod: data.paymentMethod,
            shipping: data.shipping,
            totalCents: (data.totals?.totalUsd ?? 0) * 100,
          });
        }
      }
      if (!cancelled) setLoading(false);
    }

    void fetchOrder();
    return () => {
      cancelled = true;
    };
  }, [orderIdParam, sessionIdParam]);

  const displayOrderId = order?.orderId ?? orderIdParam;
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/checkout/success${orderIdParam ? `?orderId=${encodeURIComponent(orderIdParam)}` : sessionIdParam ? `?session_id=${encodeURIComponent(sessionIdParam)}` : ""}`
      : "";
  const shareText = `I just ordered from ${SEO_CONFIG.name}!`;

  const copyLink = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(
      () => toast.success("Link copied"),
      () => toast.error("Could not copy"),
    );
  }, [shareUrl]);

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);
  const xShareUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;

  // Only show post-purchase forms (marketing consent, account creation) on first visit by the buyer
  const isFirstVisit = order?.accessLevel === "first_visit";
  // PII is available for owner, admin, or first-visit
  const canSeePII = order?.accessLevel !== "public";
  // Has full shipping info (not just countryCode)
  const hasFullShipping = order?.shipping?.address1 || order?.shipping?.name;
  // Order is digital-only (all items are eSIM): no shipping copy, show eSIM dashboard CTA
  const isDigitalOnlyOrder =
    Boolean(order?.items?.length) &&
    (order?.items ?? []).every((i) => /^eSIM:/i.test(i.name ?? ""));
  const hasRealEmail = isRealEmail(order?.email);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading your order…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        container mx-auto max-w-7xl px-4 py-12
        sm:px-6 sm:py-16
        lg:px-8
      `}
    >
      {/* ───── Hero: Success confirmation ───── */}
      <div className="flex flex-col items-center text-center">
        <div
          className={`
            mb-5 flex size-16 items-center justify-center rounded-full
            bg-green-500/15
            sm:size-20
          `}
        >
          <Check
            className={`
              size-8 text-green-600
              sm:size-10
              dark:text-green-400
            `}
          />
        </div>
        <h1
          className={`
            text-2xl font-bold tracking-tight
            sm:text-3xl
          `}
        >
          Order confirmed!
        </h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          Thank you for your purchase. We&apos;re preparing your order.
        </p>

        {/* Confirmation email banner — only when we have a real email (not wallet placeholder) */}
        {canSeePII && hasRealEmail && order?.email && (
          <div
            className={`
              mt-5 w-full max-w-md rounded-lg border border-green-200
              bg-green-50/50 px-4 py-3 text-left
              dark:border-green-900/50 dark:bg-green-950/20
            `}
          >
            <div
              className={`
                flex items-start gap-2.5 text-sm text-green-700
                dark:text-green-400
              `}
            >
              <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">Confirmation email sent</p>
                <p
                  className={`
                    mt-0.5 text-green-600/80
                    dark:text-green-400/70
                  `}
                >
                  {isDigitalOnlyOrder ? (
                    <>
                      We&apos;ve sent order details to{" "}
                      <span className="font-medium">{order.email}</span>. Visit
                      the eSIM dashboard to activate your eSIM now.
                    </>
                  ) : (
                    <>
                      We&apos;ve sent order details and tracking info to{" "}
                      <span className="font-medium">{order.email}</span>. Most
                      orders ship within 1 business day.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No real email (e.g. crypto auth): show order lookup / account message */}
        {canSeePII && !hasRealEmail && (
          <div
            className={`
              mt-5 w-full max-w-md rounded-lg border border-border bg-muted/50
              px-4 py-3 text-left
            `}
          >
            <p className="text-sm text-muted-foreground">
              {user?.id ? (
                <>Log into your account to see your order details.</>
              ) : (
                <>
                  Save your Order ID{" "}
                  {displayOrderId && (
                    <span className="font-medium">
                      #{displayOrderId.slice(0, 8)}
                    </span>
                  )}{" "}
                  so you can look up your order any time.
                </>
              )}
            </p>
            {isDigitalOnlyOrder && (
              <p className="mt-2 text-sm text-muted-foreground">
                Visit the eSIM dashboard to activate your eSIM now.
              </p>
            )}
          </div>
        )}

        {/* Redacted banner for public viewers */}
        {!canSeePII && (
          <div
            className={`
              mt-5 w-full max-w-md rounded-lg border border-border bg-muted/50
              px-4 py-3 text-left
            `}
          >
            <p className="text-sm text-muted-foreground">
              Order details have been sent to the buyer&apos;s email. Sign in to
              view full order information.
            </p>
          </div>
        )}
      </div>

      {/* ───── Order details ───── */}
      {order && order.items.length > 0 && (
        <div
          className={`
            mt-10 rounded-xl border border-border bg-card p-5
            sm:p-6
          `}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Order details</h2>
            {displayOrderId && (
              <span className="text-sm text-muted-foreground">
                #{displayOrderId.slice(0, 8)}
              </span>
            )}
          </div>

          {/* Items (always visible — these are product info, not PII) */}
          <div className="mt-5 divide-y divide-border">
            {order.items.map((item) => (
              <div
                className={`
                  flex items-center justify-between py-3
                  first:pt-0
                  last:pb-0
                `}
                key={`${item.name}-${item.quantity}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`
                      flex size-10 items-center justify-center rounded-md
                      bg-muted
                    `}
                  >
                    <Package
                      aria-hidden
                      className="size-4 text-muted-foreground"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    {item.quantity > 1 && (
                      <p className="text-xs text-muted-foreground">
                        Qty: {item.quantity}
                      </p>
                    )}
                  </div>
                </div>
                {item.subtotalUsd != null && (
                  <span className="text-sm font-medium">
                    ${item.subtotalUsd.toFixed(2)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-4 border-t border-border pt-4">
            <div className="flex justify-between text-base font-semibold">
              <span>Total paid</span>
              <span>${(order.totalCents / 100).toFixed(2)}</span>
            </div>
          </div>

          {/* Meta: payment, date, shipping */}
          <div
            className={`
              mt-5 grid gap-4
              sm:grid-cols-2
              lg:grid-cols-3
            `}
          >
            {order.paymentMethod && (
              <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                <p
                  className={`
                    text-xs font-medium tracking-wider text-muted-foreground
                    uppercase
                  `}
                >
                  Payment
                </p>
                <p className="mt-0.5 text-sm">
                  {paymentMethodLabel(
                    order.paymentMethod,
                    order.cryptoCurrency,
                  )}
                </p>
              </div>
            )}
            {order.createdAt && (
              <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                <p
                  className={`
                    text-xs font-medium tracking-wider text-muted-foreground
                    uppercase
                  `}
                >
                  Date
                </p>
                <p className="mt-0.5 text-sm">
                  {new Date(order.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            )}
            {isDigitalOnlyOrder ? (
              <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                <p
                  className={`
                    text-xs font-medium tracking-wider text-muted-foreground
                    uppercase
                  `}
                >
                  Redeem now
                </p>
                <p className="mt-0.5 text-sm">
                  <Link
                    className={`
                      font-medium text-primary underline underline-offset-2
                      hover:no-underline
                    `}
                    href="/dashboard/esim"
                  >
                    Your eSIM is ready — import it in your dashboard
                  </Link>
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                <p
                  className={`
                    text-xs font-medium tracking-wider text-muted-foreground
                    uppercase
                  `}
                >
                  Estimated delivery
                </p>
                <p className="mt-0.5 text-sm">
                  {order.shipping?.countryCode === "US"
                    ? "2–4 business days"
                    : "5–14 business days"}
                </p>
              </div>
            )}
          </div>

          {/* Shipping address — full when authorized, hidden for public */}
          {hasFullShipping && order.shipping && (
            <div className="mt-5 border-t border-border pt-4">
              <p
                className={`
                  text-xs font-medium tracking-wider text-muted-foreground
                  uppercase
                `}
              >
                Shipping to
              </p>
              <div className="mt-1 text-sm">
                {formatShippingAddress(order.shipping).map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          )}
          {!hasFullShipping && order.shipping?.countryCode && !canSeePII && (
            <div className="mt-5 border-t border-border pt-4">
              <p
                className={`
                  text-xs font-medium tracking-wider text-muted-foreground
                  uppercase
                `}
              >
                Shipping to
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Shipping address on file
              </p>
            </div>
          )}
        </div>
      )}

      {/* Fallback if no order data loaded */}
      {!order && displayOrderId && (
        <div
          className={`
            mt-10 rounded-xl border border-border bg-card p-5
            sm:p-6
          `}
        >
          <h2 className="text-lg font-semibold">Order details</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Order #{displayOrderId.slice(0, 8)}. Sign in to view order details
            or save this ID to look up your order any time.
          </p>
        </div>
      )}

      {!order && !displayOrderId && (
        <div
          className={`
            mt-10 rounded-xl border border-border bg-card p-5
            sm:p-6
          `}
        >
          <h2 className="text-lg font-semibold">Order details</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your payment was successful. We&apos;ll send a confirmation email
            with your order details.
          </p>
        </div>
      )}

      {/* ───── Post-purchase sections: first visit + notification options for owners ───── */}
      {(isFirstVisit || (canSeePII && user?.id)) && (
        <div className="mt-10 flex flex-col gap-8">
          {/* Account creation for guests (first visit with real email) */}
          {isFirstVisit && (
            <CreateAccountCard
              email={hasRealEmail ? order?.email : undefined}
            />
          )}

          {/* Notification / marketing consent — show for first visit or authenticated owner */}
          {(order?.orderId ?? orderIdParam) && (
            <div
              className={`
                rounded-xl border border-border bg-card p-5
                sm:p-6
              `}
            >
              <MarketingConsent
                email={hasRealEmail ? order?.email : undefined}
                hasPhone={Boolean(order?.shipping?.phone)}
                orderId={order?.orderId ?? orderIdParam ?? ""}
              />
            </div>
          )}
        </div>
      )}

      {/* ───── Actions ───── */}
      <div
        className={`
          mt-10 flex flex-col items-center gap-4
          sm:flex-row sm:flex-wrap sm:justify-center
        `}
      >
        {isDigitalOnlyOrder && (
          <Button
            asChild
            className={`
              w-full
              sm:w-auto
            `}
            size="lg"
          >
            <Link href="/dashboard/esim">
              <Package className="mr-2 size-4" />
              eSIM dashboard
            </Link>
          </Button>
        )}
        <Button
          asChild
          className={`
            w-full
            sm:w-auto
          `}
          size="lg"
          variant={isDigitalOnlyOrder ? "outline" : undefined}
        >
          <Link href="/products">
            <ShoppingBag className="mr-2 size-4" />
            Continue shopping
          </Link>
        </Button>
        <Button
          asChild
          className={`
            w-full
            sm:w-auto
          `}
          size="lg"
          variant="outline"
        >
          <Link href="/">Back to home</Link>
        </Button>
      </div>

      {/* ───── Share & referral ───── */}
      <div
        className={`
          mt-10 flex flex-col items-center border-t border-border pt-8
        `}
      >
        <p className="text-sm font-medium text-muted-foreground">
          Share your purchase
        </p>
        <div className="mt-3 flex items-center gap-2">
          <a
            aria-label="Share on X (Twitter)"
            className={`
              inline-flex size-10 items-center justify-center rounded-full
              border border-input bg-background text-muted-foreground
              transition-colors
              hover:bg-muted hover:text-foreground
            `}
            href={xShareUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {X_ICON}
          </a>
          <a
            aria-label="Share on Facebook"
            className={`
              inline-flex size-10 items-center justify-center rounded-full
              border border-input bg-background text-muted-foreground
              transition-colors
              hover:bg-muted hover:text-foreground
            `}
            href={facebookShareUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <svg
              aria-hidden
              fill="currentColor"
              height="18"
              viewBox="0 0 24 24"
              width="18"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </a>
          <Button
            aria-label="Copy link"
            className="size-10 rounded-full"
            onClick={copyLink}
            size="icon"
            variant="outline"
          >
            <Link2 className="size-4" />
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Share with a friend for 10% off your next purchase.
        </p>
      </div>
    </div>
  );
}

/** Read and consume (delete) the confirmation token from sessionStorage. */
function consumeConfirmationToken(key: string): null | string {
  try {
    const token = sessionStorage.getItem(key);
    if (token) sessionStorage.removeItem(key);
    return token;
  } catch {
    return null;
  }
}

/* ---------- CreateAccount card wrapper ---------- */
function CreateAccountCard({ email }: { email?: string }) {
  const { user } = useCurrentUser();
  if (user?.email) return null;
  if (!email) return null;
  return (
    <div
      className={`
        rounded-xl border border-border bg-card p-5
        sm:p-6
      `}
    >
      <CreateAccountViaEmail email={email} />
    </div>
  );
}

/* ---------- Post-purchase account creation via email verification ---------- */
function CreateAccountViaEmail({ email }: { email?: string }) {
  const { user } = useCurrentUser();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  if (user?.email) return null;
  if (!email) return null;

  if (sent) {
    return (
      <div
        className={`
          rounded-lg border border-green-200 bg-green-50/50 px-4 py-3
          dark:border-green-900/50 dark:bg-green-950/20
        `}
      >
        <div
          className={`
            flex items-center gap-2 text-sm text-green-700
            dark:text-green-400
          `}
        >
          <Check aria-hidden className="size-4 shrink-0" />
          <span className="font-medium">
            Check your email! We&apos;ve sent a link to <strong>{email}</strong>{" "}
            to set up your account.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Mail aria-hidden className="size-4 text-primary" />
        <p className="text-sm font-medium">Save your info for next time</p>
      </div>
      <p className="text-xs text-muted-foreground">
        We&apos;ll send a link to <strong>{email}</strong> so you can set a
        password and track your orders. Your shipping details are already saved
        with this order.
      </p>
      <Button
        disabled={sending}
        onClick={async () => {
          setSending(true);
          setError("");
          try {
            // Create account with a random password; user will set their own via the reset link
            const tempPassword = `${crypto.randomUUID()}Aa1!`;
            const result = await signUp.email({
              email,
              name: email.split("@")[0] ?? "",
              password: tempPassword,
            });
            if (result?.error) {
              // Account may already exist
              setError(
                typeof result.error.message === "string"
                  ? result.error.message
                  : "Could not create account. You may already have one.",
              );
              setSending(false);
              return;
            }
            // Send password reset email so user can set their own password
            await requestPasswordReset({ email });
            setSent(true);
          } catch {
            setError("Could not send setup email. Please try again.");
          } finally {
            setSending(false);
          }
        }}
        size="sm"
      >
        {sending ? (
          <>
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Mail className="mr-1.5 size-3.5" />
            Send me a setup link
          </>
        )}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground/70">
        By creating an account you agree to our Terms of Service and Privacy
        Policy.
      </p>
    </div>
  );
}

function formatShippingAddress(s: ShippingAddress): string[] {
  const lines: string[] = [];
  if (s.name?.trim()) lines.push(s.name.trim());
  if (s.address1?.trim()) lines.push(s.address1.trim());
  if (s.address2?.trim()) lines.push(s.address2.trim());
  const cityLine = [s.city, s.stateCode, s.zip].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);
  if (s.countryCode?.trim()) lines.push(s.countryCode.trim());
  if (s.phone?.trim()) lines.push(s.phone.trim());
  return lines;
}

/* ---------- Marketing consent (first visit only) ---------- */
function MarketingConsent({
  email,
  hasPhone,
  orderId,
}: {
  email?: string;
  hasPhone: boolean;
  orderId: string;
}) {
  const [emailConsent, setEmailConsent] = useState(Boolean(email));
  const [smsConsent, setSmsConsent] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const showPhoneInput = smsConsent && !hasPhone;

  const handleSave = useCallback(async () => {
    if (!email) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/marketing-consent`,
        {
          body: JSON.stringify({
            email,
            emailConsent,
            smsConsent,
            ...(showPhoneInput && phone.trim() ? { phone: phone.trim() } : {}),
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      if (res.ok) {
        setSaved(true);
        toast.success("Preferences saved");
      } else {
        toast.error("Could not save preferences");
      }
    } catch {
      toast.error("Could not save preferences");
    } finally {
      setSaving(false);
    }
  }, [orderId, email, emailConsent, smsConsent, showPhoneInput, phone]);

  if (saved) {
    return (
      <div
        className={`
          flex items-center gap-2 text-sm text-green-600
          dark:text-green-400
        `}
      >
        <Check className="size-4" />
        <span>Preferences saved</span>
      </div>
    );
  }

  // No email (e.g. crypto auth): show guidance instead of form
  if (!email) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Stay in the loop</p>
        <p className="text-sm text-muted-foreground">
          Add your email in account settings to receive order updates and
          offers. Save your Order ID above to look up this order any time.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/profile">Account settings</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">Stay in the loop</p>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={emailConsent}
          onCheckedChange={(v) => setEmailConsent(v === true)}
        />
        <span>Email me with news and offers</span>
      </label>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={smsConsent}
            onCheckedChange={(v) => setSmsConsent(v === true)}
          />
          <span>Text me with news and offers</span>
        </label>
        {showPhoneInput && (
          <Input
            aria-label="Phone number for SMS updates"
            className="h-9 max-w-xs"
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            type="tel"
            value={phone}
          />
        )}
      </div>
      <Button
        disabled={saving || (!emailConsent && !smsConsent)}
        onClick={handleSave}
        size="sm"
        variant="outline"
      >
        {saving ? (
          <>
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            Saving…
          </>
        ) : (
          "Save preferences"
        )}
      </Button>
    </div>
  );
}

function paymentMethodLabel(
  method: string | undefined,
  cryptoCurrency?: string,
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
  if (m === "crypto") return "Crypto";
  return method ?? "—";
}
