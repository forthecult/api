"use client";

import Image from "next/image";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useCart } from "~/lib/hooks/use-cart";
import { useCurrentUser } from "~/lib/auth-client";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import {
  COUNTRY_OPTIONS_ALPHABETICAL,
  useCountryCurrency,
} from "~/lib/hooks/use-country-currency";
import { SEO_CONFIG } from "~/app";
import { FiatPrice } from "~/ui/components/FiatPrice";
import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";
import { getAffiliateCodeFromDocument } from "~/lib/affiliate-tracking";
import { OrderSummary } from "./components/OrderSummary";
import {
  ShippingAddressForm,
  type ShippingAddressFormRef,
  type ShippingUpdate,
} from "./components/ShippingAddressForm";
import {
  BillingAddressForm,
  type BillingAddressFormRef,
} from "./components/BillingAddressForm";
import { PaymentMethodSection } from "./components/PaymentMethodSection";

function getAffiliatePayload(): { affiliateCode?: string } {
  const code = getAffiliateCodeFromDocument();
  return code ? { affiliateCode: code } : {};
}

/** When checkout is opened from Telegram Mini App (source=telegram or path /telegram/*), include Telegram user in create-order payload. */
function getTelegramOrderPayload(): {
  telegramUserId?: string;
  telegramUsername?: string;
  telegramFirstName?: string;
} {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname ?? "";
  const fromTelegram =
    params.get("source") === "telegram" || pathname.startsWith("/telegram");
  if (!fromTelegram) return {};
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (!user) return {};
  return {
    telegramUserId: String(user.id),
    ...(user.username ? { telegramUsername: user.username } : {}),
    ...(user.first_name ? { telegramFirstName: user.first_name } : {}),
  };
}

/** All countries we ship to (from site country list, excluding restricted). */
const COUNTRY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Select country" },
  ...COUNTRY_OPTIONS_ALPHABETICAL.filter((o) => !isShippingExcluded(o.code)).map(
    (o) => ({ value: o.code, label: o.countryName }),
  ),
];

export function CheckoutClient() {
  const { isHydrated, items, subtotal, itemCount } = useCart();
  const { user, isPending: authPending } = useCurrentUser();
  const { selectedCountry } = useCountryCurrency();
  const isLoggedIn = Boolean(user?.email);
  const userReceiveMarketing =
    (user as { receiveMarketing?: boolean } | null)?.receiveMarketing === true;
  const userReceiveSmsMarketing =
    (user as { receiveSmsMarketing?: boolean } | null)?.receiveSmsMarketing ===
    true;
  const shippingFormRef = useRef<ShippingAddressFormRef>(null);
  const billingFormRef = useRef<BillingAddressFormRef>(null);

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [shipping, setShipping] = useState<ShippingUpdate>({
    shippingCents: 0,
    shippingLabel: null,
    shippingFree: false,
    shippingLoading: false,
    canShipToCountry: true,
    shippingSpeed: "standard",
    taxCents: 0,
    taxNote: null,
    customsDutiesNote: null,
  });
  const [navigatingToPay, setNavigatingToPay] = useState(false);
  const [discountCodeInput, setDiscountCodeInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    couponId: string;
    code: string;
    discountKind: string;
    discountType: string;
    discountValue: number;
    discountCents: number;
    freeShipping: boolean;
    totalAfterDiscountCents: number;
    source: "code" | "automatic";
  } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [showDiscountCode, setShowDiscountCode] = useState(false);
  const [automaticCouponLoading, setAutomaticCouponLoading] = useState(false);
  /** Bump when user removes discount so we re-evaluate automatic. */
  const [discountEvalKey, setDiscountEvalKey] = useState(0);
  /** Crypto total label (e.g. "≈ 0.0875 SOL") set by PaymentMethodSection for OrderSummary. */
  const [cryptoTotalLabel, setCryptoTotalLabel] = useState<string | null>(null);

  const handleShippingUpdate = useCallback((update: ShippingUpdate) => {
    setShipping(update);
  }, []);

  // Destructure shipping state for easy access throughout the component
  const {
    shippingCents,
    shippingFree,
    shippingLoading,
    canShipToCountry,
    shippingSpeed,
    taxCents,
    taxNote,
    customsDutiesNote,
  } = shipping;

  /** Build the common order payload used by all payment handlers. */
  const buildOrderPayload = useCallback(() => {
    const form = shippingFormRef.current?.getForm();
    const emailNewsVal = shippingFormRef.current?.getEmailNews() ?? true;
    const textNewsVal = shippingFormRef.current?.getTextNews() ?? false;
    const orderItems = items.map((item) => ({
      productId: item.productId ?? item.id,
      ...(item.productVariantId && { productVariantId: item.productVariantId }),
      name: item.name,
      priceCents: Math.round(item.price * 100),
      quantity: item.quantity,
    }));
    const subtotalCents = orderItems.reduce(
      (sum, i) => sum + i.priceCents * i.quantity,
      0,
    );
    const discountCentsForOrder = appliedCoupon?.discountCents ?? 0;
    const shippingFeeCentsRounded = Math.round(shippingCents);
    const taxCentsRounded = Math.round(taxCents);
    const orderTotalCents =
      subtotalCents - discountCentsForOrder + shippingFeeCentsRounded + taxCentsRounded;
    const emailRaw = form?.email?.trim();
    const emailValid =
      typeof emailRaw === "string" &&
      emailRaw.length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw);
    const email = emailValid ? emailRaw! : "guest@checkout.local";
    return {
      form,
      emailNewsVal,
      textNewsVal,
      orderItems,
      subtotalCents,
      orderTotalCents,
      shippingFeeCentsRounded,
      taxCentsRounded,
      email,
      /** Common body fields shared by all create-order APIs */
      commonBody: {
        email: email.toLowerCase(),
        orderItems,
        totalCents: orderTotalCents,
        shippingFeeCents: shippingFeeCentsRounded,
        taxCents: taxCentsRounded,
        userId: user?.id ?? null,
        emailMarketingConsent:
          isLoggedIn && userReceiveMarketing ? true : emailNewsVal,
        smsMarketingConsent:
          isLoggedIn && userReceiveSmsMarketing ? true : textNewsVal,
        ...getTelegramOrderPayload(),
        ...getAffiliatePayload(),
        ...(appliedCoupon?.code ? { couponCode: appliedCoupon.code } : {}),
      },
    };
  }, [items, shippingCents, taxCents, user?.id, isLoggedIn, userReceiveMarketing, userReceiveSmsMarketing, appliedCoupon]);

  const discountCents = appliedCoupon?.discountCents ?? 0;
  const totalCents =
    Math.round(subtotal * 100) - discountCents + shippingCents + taxCents;
  const total = Math.max(0, totalCents) / 100;

  const handleApplyCoupon = useCallback(async () => {
    const code = discountCodeInput.trim();
    if (!code) return;
    setCouponError("");
    setCouponLoading(true);
    try {
      const res = await fetch("/api/checkout/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code,
          subtotalCents: Math.round(subtotal * 100),
          shippingFeeCents: Math.round(shippingCents),
          productIds: items.map((i) => i.productId ?? i.id),
        }),
      });
      const data = (await res.json()) as
        | { valid: true; couponId: string; code: string; discountKind: string; discountType: string; discountValue: number; discountCents: number; freeShipping: boolean; totalAfterDiscountCents: number }
        | { valid: false; error?: string };
      if (data.valid) {
        setAppliedCoupon({
          couponId: data.couponId,
          code: data.code,
          discountKind: data.discountKind,
          discountType: data.discountType,
          discountValue: data.discountValue,
          discountCents: data.discountCents,
          freeShipping: data.freeShipping,
          totalAfterDiscountCents: data.totalAfterDiscountCents,
          source: "code",
        });
        setDiscountCodeInput("");
      } else {
        setCouponError(
          typeof data.error === "string" && data.error.length > 0
            ? data.error
            : "This discount code is invalid or expired.",
        );
      }
    } catch {
      setCouponError("Could not validate discount code. Please try again.");
    } finally {
      setCouponLoading(false);
    }
  }, [discountCodeInput, subtotal, shippingCents, items]);

  // Fetch and apply best automatic discount when no code has been applied (or only automatic was applied)
  useEffect(() => {
    // Don't overwrite a discount the customer applied via code
    if (appliedCoupon?.source === "code") return;
    if (items.length === 0) {
      setAppliedCoupon(null);
      return;
    }
    let cancelled = false;
    setAutomaticCouponLoading(true);
    const productCount = items.reduce((sum, i) => sum + (i.quantity ?? 1), 0);
    fetch("/api/checkout/coupons/automatic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        subtotalCents: Math.round(subtotal * 100),
        shippingFeeCents: Math.round(shippingCents),
        productCount,
        productIds: items.map((i) => i.productId ?? i.id),
      }),
    })
      .then((res) => res.json())
      .then((data: { applied: boolean } & Record<string, unknown>) => {
        if (cancelled) return;
        if (data.applied && data.couponId && data.code != null) {
          setAppliedCoupon({
            couponId: data.couponId as string,
            code: data.code as string,
            discountKind: (data.discountKind as string) ?? "amount_off_order",
            discountType: (data.discountType as string) ?? "percent",
            discountValue: typeof data.discountValue === "number" ? data.discountValue : 0,
            discountCents: typeof data.discountCents === "number" ? data.discountCents : 0,
            freeShipping: data.freeShipping === true,
            totalAfterDiscountCents:
              typeof data.totalAfterDiscountCents === "number"
                ? data.totalAfterDiscountCents
                : 0,
            source: "automatic",
          });
        } else {
          setAppliedCoupon(null);
        }
      })
      .catch(() => {
        if (!cancelled) setAppliedCoupon(null);
      })
      .finally(() => {
        if (!cancelled) setAutomaticCouponLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [items, subtotal, shippingCents, discountEvalKey]);

  if (!isHydrated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Loading…
          </CardTitle>
          <CardDescription>Checking your cart.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your cart is empty</CardTitle>
          <CardDescription>
            Add items from the store before checking out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/products">Browse products</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex w-full justify-center px-4">
      <div className="w-full max-w-5xl">
        <div className="grid gap-8 pt-4 sm:grid-cols-[1fr,340px] md:grid-cols-[1fr,380px] lg:grid-cols-[1fr,400px]">
          {/* Left: contact, address, shipping method, payment, place order + policy links */}
          <div className="min-w-0 space-y-6 sm:col-start-1">
            <ShippingAddressForm
              ref={shippingFormRef}
              countryOptions={COUNTRY_OPTIONS}
              items={items}
              subtotal={subtotal}
              appliedCoupon={appliedCoupon}
              selectedCountry={selectedCountry}
              user={user}
              isLoggedIn={isLoggedIn}
              userReceiveMarketing={userReceiveMarketing}
              userReceiveSmsMarketing={userReceiveSmsMarketing}
              authPending={authPending}
              validationErrors={validationErrors}
              onShippingUpdate={handleShippingUpdate}
            />

            <PaymentMethodSection
              buildOrderPayload={buildOrderPayload}
              shippingFormRef={shippingFormRef}
              billingFormRef={billingFormRef}
              total={total}
              canShipToCountry={canShipToCountry}
              countryOptions={COUNTRY_OPTIONS}
              validationErrors={validationErrors}
              setValidationErrors={setValidationErrors}
              navigatingToPay={navigatingToPay}
              setNavigatingToPay={setNavigatingToPay}
              onCryptoTotalLabelChange={setCryptoTotalLabel}
            />
          </div>
          {/* Right: Your order only — sticky offset below header (max-h-24) so header doesn't overlap */}
          <div className="min-w-0 space-y-6 sm:col-start-2 sm:sticky sm:top-28 sm:self-start">
            <OrderSummary
              items={items}
              itemCount={itemCount}
              subtotal={subtotal}
              shippingCents={shippingCents}
              shippingLoading={shippingLoading}
              shippingFree={shippingFree}
              taxCents={taxCents}
              taxNote={taxNote}
              customsDutiesNote={customsDutiesNote}
              appliedCoupon={appliedCoupon}
              total={total}
              cryptoTotalLabel={cryptoTotalLabel}
              showDiscountCode={showDiscountCode}
              discountCodeInput={discountCodeInput}
              couponError={couponError}
              couponLoading={couponLoading}
              onShowDiscountCode={() => setShowDiscountCode(true)}
              onDiscountCodeInputChange={(v) => {
                setDiscountCodeInput(v);
                setCouponError("");
              }}
              onApplyCoupon={handleApplyCoupon}
              onRemoveCoupon={() => {
                setAppliedCoupon(null);
                setCouponError("");
                setDiscountEvalKey((k) => k + 1);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
