"use client";

import { Check, Copy, Eye, EyeOff, Link2, Loader2, ShoppingBag, UserPlus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { SEO_CONFIG } from "~/app";
import { signUp, useCurrentUser } from "~/lib/auth-client";
import { useCart } from "~/lib/hooks/use-cart";
import { Button } from "~/ui/primitives/button";
import { Checkbox } from "~/ui/primitives/checkbox";
import { Input } from "~/ui/primitives/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";

const X_ICON = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

function paymentMethodLabel(method: string | undefined): string {
  const m = (method ?? "").toLowerCase();
  if (m === "stripe") return "Credit / Debit card";
  if (m === "solana_pay") return "Solana";
  if (m === "eth_pay") return "Ethereum";
  if (m === "btcpay") return "Bitcoin";
  if (m === "ton_pay") return "TON";
  if (m === "crypto") return "Crypto";
  return method ?? "—";
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

type ShippingAddress = {
  name?: string;
  address1?: string;
  address2?: string;
  city?: string;
  stateCode?: string;
  zip?: string;
  countryCode?: string;
  phone?: string;
};

type OrderDetails = {
  orderId: string;
  email?: string;
  paymentMethod?: string;
  totalCents: number;
  createdAt: string;
  items: Array<{
    name: string;
    quantity: number;
    priceUsd?: number;
    subtotalUsd?: number;
  }>;
  shipping?: ShippingAddress;
};

function MarketingConsent({
  orderId,
  email,
  hasPhone,
}: {
  orderId: string;
  email?: string;
  hasPhone: boolean;
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
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            emailConsent,
            smsConsent,
            ...(showPhoneInput && phone.trim() ? { phone: phone.trim() } : {}),
          }),
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
      <div className="mt-8 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
        <Check className="size-4" />
        <span>Preferences saved</span>
      </div>
    );
  }

  return (
    <div className="mt-8 w-full space-y-3">
      <p className="text-sm font-medium text-muted-foreground">
        Stay in the loop
      </p>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={emailConsent}
          onCheckedChange={(v) => setEmailConsent(v === true)}
        />
        <span>Email me with news and offers</span>
      </label>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={smsConsent}
            onCheckedChange={(v) => setSmsConsent(v === true)}
          />
          <span>Text me with news and offers</span>
        </label>
        {showPhoneInput && (
          <Input
            type="tel"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-9 max-w-xs"
            aria-label="Phone number for SMS updates"
          />
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={saving || (!emailConsent && !smsConsent)}
        onClick={handleSave}
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

/** Post-purchase account creation for guest checkout users. */
function CreateAccount({ email }: { email?: string }) {
  const { user } = useCurrentUser();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");

  // Don't show if already logged in
  if (user?.email) return null;
  // Don't show if no email from order
  if (!email) return null;

  if (created) {
    return (
      <div className="mt-8 w-full rounded-md border border-green-200 bg-green-50/50 px-4 py-3 dark:border-green-900/50 dark:bg-green-950/20">
        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
          <Check className="size-4 shrink-0" aria-hidden />
          <span className="font-medium">Account created! You can now track your orders.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 w-full space-y-3">
      <div className="flex items-center gap-2">
        <UserPlus className="size-4 text-primary" aria-hidden />
        <p className="text-sm font-medium">Save your info for next time</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Create an account to track this order and speed up future checkouts. Your email and shipping details are already saved.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="relative min-w-0 flex-1">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Choose a password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            className="h-9 pr-9"
            aria-label="Password"
            disabled={creating}
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </div>
        <Button
          size="sm"
          className="h-9 shrink-0"
          disabled={creating || password.length < 8}
          onClick={async () => {
            if (password.length < 8) {
              setError("Password must be at least 8 characters");
              return;
            }
            setCreating(true);
            setError("");
            try {
              const result = await signUp.email({
                email,
                password,
                name: email.split("@")[0] ?? "",
              });
              if (result?.error) {
                setError(
                  typeof result.error.message === "string"
                    ? result.error.message
                    : "Could not create account. You may already have one.",
                );
              } else {
                setCreated(true);
                toast.success("Account created!");
              }
            } catch {
              setError("Could not create account. Please try again.");
            } finally {
              setCreating(false);
            }
          }}
        >
          {creating ? (
            <>
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              Creating…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <p className="text-[11px] text-muted-foreground/70">
        By creating an account you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}

export function SuccessPageClient() {
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get("orderId");
  const sessionIdParam = searchParams.get("session_id");
  const { clearCart } = useCart();

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Clear cart when user lands on success page after completing checkout
  useEffect(() => {
    if (orderIdParam || sessionIdParam) {
      clearCart();
    }
  }, [orderIdParam, sessionIdParam, clearCart]);

  useEffect(() => {
    let cancelled = false;

    async function fetchOrder() {
      if (sessionIdParam) {
        const res = await fetch(
          `/api/orders/by-session?session_id=${encodeURIComponent(sessionIdParam)}`,
        );
        if (!cancelled && res.ok) {
          const data = (await res.json()) as OrderDetails;
          setOrder(data);
        }
      } else if (orderIdParam) {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderIdParam)}`, {
          credentials: "include",
        });
        if (!cancelled && res.ok) {
          const data = (await res.json()) as {
            orderId: string;
            email?: string;
            paymentMethod?: string;
            createdAt: string;
            items: Array<{
              name: string;
              quantity: number;
              priceUsd?: number;
              subtotalUsd?: number;
            }>;
            totals?: { totalUsd: number };
            shipping?: ShippingAddress;
          };
          setOrder({
            orderId: data.orderId,
            email: data.email,
            paymentMethod: data.paymentMethod,
            totalCents: (data.totals?.totalUsd ?? 0) * 100,
            createdAt: data.createdAt,
            items: data.items ?? [],
            shipping: data.shipping,
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

  return (
    <div className="container flex min-h-[60vh] flex-col items-center py-16">
      <div className="flex w-full max-w-2xl flex-col gap-8 md:flex-row md:gap-10">
        {/* Left: Success message + actions */}
        <div className="flex flex-1 flex-col items-center text-center md:items-start md:text-left">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15">
            <Check className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Order confirmed!</h1>
          <p className="mt-1 text-muted-foreground">
            Thank you for your purchase. We&apos;re preparing your order.
          </p>
          <div className="mt-3 w-full rounded-md border border-green-200 bg-green-50/50 px-4 py-3 dark:border-green-900/50 dark:bg-green-950/20">
            <div className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400">
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">Confirmation email sent</p>
                <p className="mt-0.5 text-green-600/80 dark:text-green-400/70">
                  We&apos;ve sent order details and tracking info to your email. Most orders ship within 1 business day.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:min-w-[200px]">
            <Button asChild className="w-full" size="lg">
              <Link href="/products">
                <ShoppingBag className="mr-2 h-4 w-4" />
                Shop more
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full" size="lg">
              <Link href="/">Back to home</Link>
            </Button>
          </div>

          {/* Share */}
          <div className="mt-8 w-full">
            <p className="text-sm font-medium text-muted-foreground">Share</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <a
                href={xShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Share on X (Twitter)"
              >
                {X_ICON}
              </a>
              <a
                href={facebookShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Share on Facebook"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={copyLink}
                aria-label="Copy link"
              >
                <Link2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Referral */}
          <p className="mt-6 text-sm text-muted-foreground">
            Share with a friend for 10% off your next purchase.
          </p>

          {/* Post-purchase account creation (guests only) */}
          {!loading && order && (
            <CreateAccount email={order.email} />
          )}

          {/* Marketing consent */}
          {!loading && order && (
            <MarketingConsent
              orderId={order.orderId}
              email={order.email}
              hasPhone={Boolean(order.shipping?.phone)}
            />
          )}
        </div>

        {/* Right: Order details */}
        <Card className="w-full flex-shrink-0 md:max-w-sm">
          <CardHeader>
            <CardTitle>Order details</CardTitle>
            {loading ? (
              <CardDescription>Loading…</CardDescription>
            ) : (
              <CardDescription>
                {displayOrderId
                  ? `Order #${displayOrderId.slice(0, 8)}`
                  : "Your order has been received."}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {order && (
              <>
                {order.email && (
                  <div className="text-sm">
                    <span className="font-medium text-muted-foreground">
                      Email:{" "}
                    </span>
                    <span>{order.email}</span>
                  </div>
                )}
                {order.paymentMethod && (
                  <div className="text-sm">
                    <span className="font-medium text-muted-foreground">
                      Payment method:{" "}
                    </span>
                    <span>
                      {paymentMethodLabel(order.paymentMethod)}
                    </span>
                  </div>
                )}
                {order.createdAt && (
                  <div className="text-sm">
                    <span className="font-medium text-muted-foreground">
                      Date:{" "}
                    </span>
                    <span>
                      {new Date(order.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                )}
                {order.items && order.items.length > 0 && (
                  <div className="space-y-2 border-t border-border pt-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Items
                    </p>
                    {order.items.map((item) => (
                      <div
                        key={`${item.name}-${item.quantity}`}
                        className="flex justify-between text-sm"
                      >
                        <span>
                          {item.name}
                          {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                        </span>
                        {item.subtotalUsd != null && (
                          <span>
                            ${item.subtotalUsd.toFixed(2)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-4 font-medium">
                  <span>Total paid</span>
                  <span>
                    ${(order.totalCents / 100).toFixed(2)}
                  </span>
                </div>
                {order.shipping &&
                  (order.shipping.address1 ||
                    order.shipping.city ||
                    order.shipping.countryCode) && (
                    <div className="space-y-1 border-t border-border pt-4">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Shipping address
                      </p>
                      <div className="text-sm">
                        {formatShippingAddress(order.shipping).map(
                          (line, i) => (
                            <p key={i}>{line}</p>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                <div className="rounded-md bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Estimated delivery</p>
                  <p className="mt-0.5">
                    {order.shipping?.countryCode === "US"
                      ? "2–4 business days after shipping"
                      : "5–14 business days after shipping"}
                  </p>
                  <p className="mt-1 text-xs">
                    You&apos;ll receive a tracking email when your order ships.
                  </p>
                </div>
              </>
            )}
            {!loading && !order && displayOrderId && (
              <>
                <p className="text-sm text-muted-foreground">
                  Order #{displayOrderId.slice(0, 8)}. We&apos;ve sent a
                  confirmation to your email.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  You&apos;ll receive an email when your order ships.
                </p>
              </>
            )}
            {!loading && !order && !displayOrderId && (
              <>
                <p className="text-sm text-muted-foreground">
                  Your payment was successful. We&apos;ll send a confirmation
                  email if we have your address.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  You&apos;ll receive an email when your order ships.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
