"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useReducer,
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
import {
  checkoutReducer,
  initialCheckoutState,
} from "./checkout-reducer";
import { useCoupons } from "./hooks/useCoupons";

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

  const [checkoutState, dispatch] = useReducer(
    checkoutReducer,
    initialCheckoutState,
  );
  const { validationErrors, navigatingToPay } = checkoutState;
  const setValidationErrors = useCallback((errors: string[]) => {
    dispatch({ type: "SET_VALIDATION_ERRORS", errors });
  }, []);
  const setNavigatingToPay = useCallback((navigating: boolean) => {
    dispatch({ type: "SET_NAVIGATING", navigating });
  }, []);

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
  /** Crypto total label (e.g. "≈ 0.0875 SOL") set by PaymentMethodSection for OrderSummary. */
  const [cryptoTotalLabel, setCryptoTotalLabel] = useState<string | null>(null);

  const handleShippingUpdate = useCallback((update: ShippingUpdate) => {
    setShipping(update);
  }, []);

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

  const coupons = useCoupons({
    subtotal,
    shippingCents,
    items,
  });
  const {
    appliedCoupon,
    discountCodeInput,
    setDiscountCodeInput,
    couponError,
    couponLoading,
    showDiscountCode,
    setShowDiscountCode,
    handleApplyCoupon,
    removeCoupon,
  } = coupons;

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
              onDiscountCodeInputChange={setDiscountCodeInput}
              onApplyCoupon={handleApplyCoupon}
              onRemoveCoupon={removeCoupon}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
